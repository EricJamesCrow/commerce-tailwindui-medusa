import type { ButtonProps as EmailButtonProps } from "@react-email/components";
import { Button as EmailButton } from "@react-email/components";
import { cx } from "../utils/cx";

const variants = {
  primary:
    "bg-button-primary-bg border border-solid text-button-primary-fg border-button-primary-bg",
  secondary:
    "bg-button-secondary-bg text-button-secondary-fg border border-solid border-button-secondary-border",
};

const sizes = {
  lg: "px-4.5 py-[9px] text-md font-semibold",
};

interface ButtonProps extends EmailButtonProps {
  color?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = ({
  color = "primary",
  size = "lg",
  ...props
}: ButtonProps) => {
  return (
    <EmailButton
      {...props}
      className={cx(
        "rounded-lg",
        variants[color],
        sizes[size],
        props.className,
      )}
    >
      {props.children}
    </EmailButton>
  );
};
