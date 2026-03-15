// backend/src/modules/resend/templates/_commerce/address-block.tsx
import { Section } from "@react-email/components";
import { Text } from "../_components/text";
import type { Address } from "../types";

export interface AddressBlockProps {
  label: string;
  address: Address;
}

export const AddressBlock = ({ label, address }: AddressBlockProps) => {
  return (
    <Section className="my-4">
      <Text className="m-0 mb-1 text-xs font-medium uppercase text-tertiary">
        {label}
      </Text>
      <Text className="m-0 text-sm text-primary">
        {address.name}
        <br />
        {address.line1}
        {address.line2 && (
          <>
            <br />
            {address.line2}
          </>
        )}
        <br />
        {address.city}
        {address.state && `, ${address.state}`} {address.postalCode}
        <br />
        {address.country}
        {address.phone && (
          <>
            <br />
            {address.phone}
          </>
        )}
      </Text>
    </Section>
  );
};
