function ToChargeAddress(input: AddressInput): {
  city: string | null;
  country: string | null;
  line1: string | null;
  line2: string | null;
  postal_code: string | null;
  state: string | null;
} {
  return {
    city: input.city ?? null,
    country: input.country ?? null,
    line1: input.line1 ?? null,
    line2: input.line2 ?? null,
    postal_code: input.postal_code ?? null,
    state: input.state ?? null,
  };
}

function ToChargeShipping(
  input: ShippingInput
): NonNullable<ChargeType['shipping']> {
  return {
    address: ToChargeAddress(input.address),
    carrier: input.carrier ?? null,
    name: input.name,
    phone: input.phone ?? null,
    tracking_number: input.tracking_number ?? null,
  };
}

function
