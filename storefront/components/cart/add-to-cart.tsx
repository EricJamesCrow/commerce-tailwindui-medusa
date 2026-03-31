"use client";

import { PlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { addItem } from "components/cart/actions";
import { useCart } from "components/cart/cart-context";
import { useProduct } from "components/product/product-context";
import { Product, ProductVariant } from "lib/types";
import { useActionState } from "react";

function SubmitButton({
  availableForSale,
  selectedVariantId,
  className,
}: {
  availableForSale: boolean;
  selectedVariantId: string | undefined;
  className?: string;
}) {
  const defaultClasses =
    "relative flex w-full items-center justify-center rounded-full bg-primary-600 p-4 tracking-wide text-white";
  const buttonClasses = className || defaultClasses;
  const disabledClasses = "cursor-not-allowed opacity-60 hover:opacity-60";

  if (!availableForSale) {
    return (
      <button disabled className={clsx(buttonClasses, disabledClasses)}>
        Out Of Stock
      </button>
    );
  }

  if (!selectedVariantId) {
    return (
      <button
        aria-label="Please select an option"
        disabled
        className={clsx(buttonClasses, disabledClasses)}
      >
        {!className && (
          <div className="absolute left-0 ml-4">
            <PlusIcon className="h-5" />
          </div>
        )}
        Add To Cart
      </button>
    );
  }

  return (
    <button
      aria-label="Add to cart"
      className={clsx(buttonClasses, {
        "cursor-pointer hover:opacity-90": !className,
      })}
    >
      {!className && (
        <div className="absolute left-0 ml-4">
          <PlusIcon className="h-5" />
        </div>
      )}
      Add To Cart
    </button>
  );
}

export function AddToCart({
  product,
  className,
  formClassName,
}: {
  product: Product;
  className?: string;
  formClassName?: string;
}) {
  const { variants, availableForSale } = product;
  const { addCartItem } = useCart();
  const { state: productState } = useProduct();
  const [message, formAction] = useActionState(addItem, null);

  const variant = variants.find((variant: ProductVariant) =>
    variant.selectedOptions.every(
      (option) => option.value === productState[option.name.toLowerCase()],
    ),
  );
  const defaultVariantId = variants.length === 1 ? variants[0]?.id : undefined;
  const selectedVariantId = variant?.id || defaultVariantId;
  const addItemAction = formAction.bind(null, selectedVariantId);
  const finalVariant = variants.find(
    (variant) => variant.id === selectedVariantId,
  )!;

  return (
    <form
      className={formClassName || "w-full"}
      action={async () => {
        addCartItem(finalVariant, product);
        addItemAction();
      }}
    >
      <SubmitButton
        availableForSale={availableForSale}
        selectedVariantId={selectedVariantId}
        className={className}
      />
      <p aria-live="polite" className="sr-only" role="status">
        {message}
      </p>
    </form>
  );
}
