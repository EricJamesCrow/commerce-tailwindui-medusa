import { defineRouteConfig } from "@medusajs/admin-sdk";
import { DocumentText } from "@medusajs/icons";
import {
  Container,
  Heading,
  Input,
  Label,
  Textarea,
  Switch,
  Button,
  Text,
  Toaster,
  toast,
} from "@medusajs/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { sdk } from "../../../lib/sdk";

type InvoiceConfig = {
  id: string;
  company_name: string;
  company_address: string;
  company_phone: string | null;
  company_email: string;
  company_logo: string | null;
  tax_id: string | null;
  notes: string | null;
  attach_to_email: boolean;
};

type InvoiceConfigResponse = {
  invoice_config: InvoiceConfig | null;
};

const InvoiceConfigPage = () => {
  const queryClient = useQueryClient();

  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [taxId, setTaxId] = useState("");
  const [notes, setNotes] = useState("");
  const [attachToEmail, setAttachToEmail] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, error } = useQuery<InvoiceConfigResponse>({
    queryKey: ["invoice-config"],
    queryFn: () => sdk.client.fetch("/admin/invoice-config"),
  });

  // Populate form when data loads
  useEffect(() => {
    if (data?.invoice_config) {
      const cfg = data.invoice_config;
      setCompanyName(cfg.company_name || "");
      setCompanyAddress(cfg.company_address || "");
      setCompanyPhone(cfg.company_phone || "");
      setCompanyEmail(cfg.company_email || "");
      setCompanyLogo(cfg.company_logo || "");
      setTaxId(cfg.tax_id || "");
      setNotes(cfg.notes || "");
      setAttachToEmail(cfg.attach_to_email ?? false);
    }
  }, [data]);

  const { mutate: saveConfig, isPending: isSaving } = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch("/admin/invoice-config", {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      toast.success("Invoice configuration saved");
      queryClient.invalidateQueries({ queryKey: ["invoice-config"] });
    },
    onError: () => {
      toast.error("Failed to save invoice configuration");
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { files } = await sdk.admin.upload.create({ files: [file] });
      if (files?.[0]?.url) {
        setCompanyLogo(files[0].url);
        toast.success("Logo uploaded");
      }
    } catch {
      toast.error("Failed to upload logo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!companyEmail.trim()) {
      toast.error("Company email is required");
      return;
    }
    if (!companyAddress.trim()) {
      toast.error("Company address is required");
      return;
    }

    saveConfig({
      company_name: companyName.trim(),
      company_address: companyAddress.trim(),
      company_phone: companyPhone.trim() || null,
      company_email: companyEmail.trim(),
      company_logo: companyLogo.trim() || null,
      tax_id: taxId.trim() || null,
      notes: notes.trim() || null,
      attach_to_email: attachToEmail,
    });
  };

  if (isLoading) {
    return (
      <Container>
        <Text>Loading configuration...</Text>
      </Container>
    );
  }

  if (isError) {
    return (
      <Container className="flex flex-col items-center gap-4 p-6">
        <Text className="text-ui-fg-error">
          Failed to load configuration:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </Text>
        <Button
          variant="secondary"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["invoice-config"] })
          }
        >
          Retry
        </Button>
      </Container>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h1">Invoice Configuration</Heading>
          <Button type="submit" isLoading={isSaving}>
            Save
          </Button>
        </div>

        <div className="flex flex-col gap-6 px-6 py-4">
          <Text className="text-ui-fg-subtle">
            Configure the company details that appear on generated invoices.
          </Text>

          <div className="flex flex-col gap-2">
            <Label htmlFor="company_name" className="font-medium">
              Company Name <span className="text-ui-fg-error">*</span>
            </Label>
            <Input
              id="company_name"
              placeholder="Your Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="company_address" className="font-medium">
              Company Address <span className="text-ui-fg-error">*</span>
            </Label>
            <Textarea
              id="company_address"
              placeholder="123 Main St, City, State, ZIP"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="company_phone" className="font-medium">
              Company Phone
            </Label>
            <Input
              id="company_phone"
              placeholder="+1 (555) 123-4567"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="company_email" className="font-medium">
              Company Email <span className="text-ui-fg-error">*</span>
            </Label>
            <Input
              id="company_email"
              type="email"
              placeholder="billing@yourcompany.com"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="font-medium">Company Logo</Label>
            <div className="flex items-center gap-4">
              {companyLogo && (
                <img
                  src={companyLogo}
                  alt="Company logo"
                  className="h-12 w-12 rounded border object-contain"
                />
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  isLoading={isUploading}
                >
                  {companyLogo ? "Change Logo" : "Upload Logo"}
                </Button>
                {companyLogo && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setCompanyLogo("")}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tax_id" className="font-medium">
              Tax ID
            </Label>
            <Input
              id="tax_id"
              placeholder="e.g. EIN, VAT number"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes" className="font-medium">
              Default Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Notes to include at the bottom of every invoice"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="attach_to_email" className="font-medium">
                Attach to Email
              </Label>
              <Text className="text-ui-fg-subtle text-sm">
                Automatically attach the invoice PDF when sending order
                confirmation emails.
              </Text>
            </div>
            <Switch
              id="attach_to_email"
              checked={attachToEmail}
              onCheckedChange={setAttachToEmail}
            />
          </div>
        </div>
      </Container>
      <Toaster />
    </form>
  );
};

export const config = defineRouteConfig({
  label: "Invoice Configuration",
  icon: DocumentText,
});

export default InvoiceConfigPage;
