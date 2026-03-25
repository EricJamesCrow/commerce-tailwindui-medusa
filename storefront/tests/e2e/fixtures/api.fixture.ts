export const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
export const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

/**
 * Direct Medusa API client for test data setup/teardown.
 * Uses the Store API with publishable key authentication.
 */
export class MedusaApiClient {
  private authToken: string | null = null;

  private async fetch(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-publishable-api-key": PUBLISHABLE_KEY,
      ...(options.headers as Record<string, string>),
    };

    if (this.authToken) {
      headers["authorization"] = `Bearer ${this.authToken}`;
    }

    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Medusa API ${options.method || "GET"} ${path} failed (${res.status}): ${body}`,
      );
    }

    return res;
  }

  /** Register a new customer and store the auth token */
  async registerCustomer(data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }): Promise<void> {
    // Step 1: Register auth identity
    const regRes = await fetch(
      `${BACKEND_URL}/auth/customer/emailpass/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      },
    );

    if (!regRes.ok) {
      const body = await regRes.text();
      throw new Error(`Auth register failed (${regRes.status}): ${body}`);
    }

    const { token } = (await regRes.json()) as { token: string };
    this.authToken = token;

    // Step 2: Create customer record
    await this.fetch("/store/customers", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
      }),
    });

    // Step 3: Login for a fresh token bound to the customer
    const loginRes = await fetch(`${BACKEND_URL}/auth/customer/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email, password: data.password }),
    });

    if (!loginRes.ok) {
      throw new Error(`Login after register failed (${loginRes.status})`);
    }

    const loginData = (await loginRes.json()) as { token: string };
    this.authToken = loginData.token;
  }

  /** Login as an existing customer */
  async login(email: string, password: string): Promise<string> {
    const res = await fetch(`${BACKEND_URL}/auth/customer/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      throw new Error(`Login failed (${res.status})`);
    }

    const { token } = (await res.json()) as { token: string };
    this.authToken = token;
    return token;
  }

  /** Get auth token (for setting cookies in browser context) */
  getAuthToken(): string {
    if (!this.authToken) throw new Error("Not authenticated");
    return this.authToken;
  }

  /** Create a customer wishlist */
  async createWishlist(
    name?: string,
  ): Promise<{ id: string; name: string | null }> {
    const res = await this.fetch("/store/customers/me/wishlists", {
      method: "POST",
      body: JSON.stringify(name ? { name } : {}),
    });
    const data = (await res.json()) as {
      wishlist: { id: string; name: string | null };
    };
    return data.wishlist;
  }

  /** Add a variant to a customer wishlist */
  async addWishlistItem(wishlistId: string, variantId: string): Promise<void> {
    await this.fetch(`/store/customers/me/wishlists/${wishlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ variant_id: variantId }),
    });
  }

  /** Delete a customer wishlist */
  async deleteWishlist(wishlistId: string): Promise<void> {
    await this.fetch(`/store/customers/me/wishlists/${wishlistId}`, {
      method: "DELETE",
    });
  }

  /** Generate a share token for a wishlist */
  async shareWishlist(wishlistId: string): Promise<string> {
    const res = await this.fetch(
      `/store/customers/me/wishlists/${wishlistId}/share`,
      { method: "POST" },
    );
    const data = (await res.json()) as { token: string };
    return data.token;
  }

  /** List customer wishlists */
  async listWishlists(): Promise<
    {
      id: string;
      name: string | null;
      items: { id: string; product_variant_id: string }[];
    }[]
  > {
    const res = await this.fetch("/store/customers/me/wishlists");
    const data = (await res.json()) as {
      wishlists: {
        id: string;
        name: string | null;
        items: { id: string; product_variant_id: string }[];
      }[];
    };
    return data.wishlists;
  }

  /** Create a guest wishlist */
  async createGuestWishlist(): Promise<{ id: string }> {
    const res = await fetch(`${BACKEND_URL}/store/wishlists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": PUBLISHABLE_KEY,
      },
    });
    if (!res.ok)
      throw new Error(`Create guest wishlist failed (${res.status})`);
    const data = (await res.json()) as { wishlist: { id: string } };
    return data.wishlist;
  }

  /** Add item to guest wishlist */
  async addGuestWishlistItem(
    wishlistId: string,
    variantId: string,
  ): Promise<void> {
    const res = await fetch(
      `${BACKEND_URL}/store/wishlists/${wishlistId}/items`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ variant_id: variantId }),
      },
    );
    if (!res.ok) throw new Error(`Add guest item failed (${res.status})`);
  }

  /** Get products to find variant IDs for test data */
  async getProducts(): Promise<
    {
      id: string;
      handle: string;
      title: string;
      variants: { id: string; title: string }[];
    }[]
  > {
    const res = await fetch(
      `${BACKEND_URL}/store/products?fields=id,handle,title,*variants.id,*variants.title&limit=10`,
      {
        headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
      },
    );
    if (!res.ok) throw new Error(`Get products failed (${res.status})`);
    const data = (await res.json()) as {
      products: {
        id: string;
        handle: string;
        title: string;
        variants: { id: string; title: string }[];
      }[];
    };
    return data.products;
  }
}
