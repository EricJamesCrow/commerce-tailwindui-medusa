"use server";

import { sdk } from "lib/medusa";
import { validatePassword } from "lib/validation";
import { TAGS } from "lib/constants";
import type { HttpTypes } from "@medusajs/types";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAuthHeaders,
  getAuthToken,
  getCartId,
  removeAuthToken,
  removeCartId,
  removeWishlistId,
  setAuthToken,
} from "lib/medusa/cookies";
import { transferWishlist } from "lib/medusa/wishlist";

export type ActionResult = { error?: string; success?: boolean } | null;

function isRateLimited(e: unknown): boolean {
  return (
    e instanceof Error &&
    "status" in e &&
    (e as Record<string, unknown>).status === 429
  );
}

function revalidateCustomer(): void {
  revalidateTag(TAGS.customers, "max");
  revalidatePath("/", "layout");
}

async function transferCart(): Promise<void> {
  const cartId = await getCartId();
  if (!cartId) return;

  const headers = await getAuthHeaders();
  await sdk.store.cart.transferCart(cartId, {}, headers);
  revalidateTag(TAGS.cart, "max");
}

export async function retrieveCustomer(): Promise<HttpTypes.StoreCustomer | null> {
  const token = await getAuthToken();
  if (!token) return null;

  const headers = await getAuthHeaders();

  try {
    const { customer } = await sdk.client.fetch<{
      customer: HttpTypes.StoreCustomer;
    }>("/store/customers/me", {
      method: "GET",
      headers,
      query: { fields: "*addresses" },
    });
    return customer;
  } catch {
    return null;
  }
}

export async function login(
  prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email) return "Email is required";
  if (!password) return "Password is required";

  try {
    const token = await sdk.auth.login("customer", "emailpass", {
      email,
      password,
    });
    await setAuthToken(token as string);
  } catch (e) {
    if (isRateLimited(e)) {
      return "Too many login attempts. Please try again in 15 minutes.";
    }
    return e instanceof Error ? e.message : "Invalid email or password";
  }

  try {
    await transferCart();
  } catch {
    // Cart transfer is best-effort — don't block login
  }

  try {
    await transferWishlist();
  } catch {
    // Wishlist transfer is best-effort — don't block login
  }

  revalidateCustomer();
  redirect("/account");
}

export async function signup(
  prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const firstName = (formData.get("first_name") as string)?.trim();
  const lastName = (formData.get("last_name") as string)?.trim();

  if (!email) return "Email is required";
  if (!password) return "Password is required";
  if (!firstName) return "First name is required";
  if (!lastName) return "Last name is required";

  const passwordError = validatePassword(password)
  if (passwordError) return passwordError

  const customerForm = {
    email,
    first_name: firstName,
    last_name: lastName,
    phone: (formData.get("phone") as string)?.trim() || undefined,
  };

  let tokenSet = false;
  try {
    // Step 1: Register auth identity, or login if identity already exists
    // (e.g. an admin user registering as a customer with the same email)
    let token: string;
    try {
      token = (await sdk.auth.register("customer", "emailpass", {
        email,
        password,
      })) as string;
    } catch (regError: unknown) {
      const isExistingIdentity =
        regError instanceof Error &&
        regError.message === "Identity with email already exists";

      if (!isExistingIdentity) throw regError;

      const loginResult = await sdk.auth.login("customer", "emailpass", {
        email,
        password,
      });

      if (typeof loginResult !== "string") {
        return "Authentication requires additional steps not supported by this flow";
      }
      token = loginResult;
    }

    await setAuthToken(token);
    tokenSet = true;

    // Step 2: Create the customer record
    const headers = await getAuthHeaders();
    await sdk.store.customer.create(customerForm, {}, headers);

    // Step 3: Login to get a fresh token bound to the customer
    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email,
      password,
    });
    await setAuthToken(loginToken as string);
  } catch (e) {
    if (tokenSet) await removeAuthToken();
    if (isRateLimited(e)) {
      return "Too many attempts. Please try again in 15 minutes.";
    }
    return e instanceof Error ? e.message : "Error creating account";
  }

  try {
    await transferCart();
  } catch {
    // Cart transfer is best-effort
  }

  try {
    await transferWishlist();
  } catch {
    // Wishlist transfer is best-effort
  }

  revalidateCustomer();
  redirect("/account");
}

export async function signout(): Promise<void> {
  try {
    await sdk.auth.logout();
  } catch {
    // Logout endpoint may fail if token already expired — proceed anyway
  }

  await removeAuthToken();
  await removeCartId();
  await removeWishlistId();

  revalidateTag(TAGS.customers, "max");
  revalidateTag(TAGS.cart, "max");
  revalidateTag(TAGS.wishlists, "max");
  revalidatePath("/", "layout");

  redirect("/");
}

export async function requestPasswordReset(
  email: string,
): Promise<{ error?: string; success?: boolean }> {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) {
    return { error: "Email is required" }
  }
  try {
    await sdk.auth.resetPassword("customer", "emailpass", {
      identifier: normalizedEmail,
    })
  } catch (e) {
    if (isRateLimited(e)) {
      return { error: "Too many attempts. Please try again in 15 minutes." }
    }
  }
  return { success: true }
}

export async function completePasswordReset(
  token: string,
  email: string,
  password: string,
): Promise<{ error?: string; success?: boolean }> {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!token) return { error: "Reset token is missing" }
  if (!normalizedEmail) return { error: "Email is missing" }
  if (!password) return { error: "Password is required" }
  const passwordError = validatePassword(password)
  if (passwordError) return { error: passwordError }
  try {
    await sdk.auth.updateProvider(
      "customer",
      "emailpass",
      { email: normalizedEmail, password },
      token,
    )
  } catch (e) {
    if (isRateLimited(e)) {
      return { error: "Too many attempts. Please try again in 15 minutes." }
    }
    return {
      error: e instanceof Error ? e.message : "Unable to reset password. The link may have expired.",
    }
  }
  return { success: true }
}

export async function updateCustomer(
  prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body: HttpTypes.StoreUpdateCustomer = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: (formData.get("phone") as string) || undefined,
  };

  const headers = await getAuthHeaders();

  try {
    await sdk.store.customer.update(body, {}, headers);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error updating profile",
    };
  } finally {
    revalidateCustomer();
  }

  return { success: true };
}

function parseAddressFields(
  formData: FormData,
): HttpTypes.StoreCreateCustomerAddress {
  return {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: (formData.get("company") as string) || undefined,
    address_1: formData.get("address_1") as string,
    address_2: (formData.get("address_2") as string) || undefined,
    city: formData.get("city") as string,
    province: (formData.get("province") as string) || undefined,
    postal_code: formData.get("postal_code") as string,
    country_code: formData.get("country_code") as string,
    phone: (formData.get("phone") as string) || undefined,
  };
}

export async function addCustomerAddress(
  prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const headers = await getAuthHeaders();

  try {
    await sdk.store.customer.createAddress(
      parseAddressFields(formData),
      {},
      headers,
    );
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error adding address",
    };
  } finally {
    revalidateCustomer();
  }

  return { success: true };
}

export async function updateCustomerAddress(
  prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const addressId = formData.get("address_id") as string;
  if (!addressId) return { error: "Address ID is required" };

  const headers = await getAuthHeaders();

  try {
    await sdk.store.customer.updateAddress(
      addressId,
      parseAddressFields(formData),
      {},
      headers,
    );
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error updating address",
    };
  } finally {
    revalidateCustomer();
  }

  return { success: true };
}

export async function deleteCustomerAddress(
  addressId: string,
): Promise<string | null> {
  const headers = await getAuthHeaders();

  try {
    await sdk.store.customer.deleteAddress(addressId, headers);
  } catch (e) {
    return e instanceof Error ? e.message : "Error deleting address";
  } finally {
    revalidateCustomer();
  }

  return null;
}
