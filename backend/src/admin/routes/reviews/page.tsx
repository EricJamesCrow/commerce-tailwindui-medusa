import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ChatBubbleLeftRight } from "@medusajs/icons";
import {
  createDataTableColumnHelper,
  createDataTableCommandHelper,
  Container,
  DataTable,
  useDataTable,
  Heading,
  StatusBadge,
  Toaster,
  toast,
  DataTablePaginationState,
  DataTableRowSelectionState,
  Drawer,
  Button,
  Textarea,
  Label,
} from "@medusajs/ui";
import { HttpTypes } from "@medusajs/framework/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sdk } from "../../lib/sdk";

type Review = {
  id: string;
  title?: string;
  content: string;
  rating: number;
  product_id: string;
  customer_id?: string;
  status: "pending" | "approved" | "flagged";
  verified_purchase: boolean;
  created_at: Date;
  updated_at: Date;
  product?: HttpTypes.AdminProduct;
  response?: {
    id: string;
    content: string;
    created_at: string;
  } | null;
};

const columnHelper = createDataTableColumnHelper<Review>();

const commandHelper = createDataTableCommandHelper();

const statusCommands = [
  { label: "Approve", shortcut: "A", status: "approved" },
  { label: "Flag", shortcut: "F", status: "flagged" },
] as const;

const useCommands = (refetch: () => void) => {
  return statusCommands.map(({ label, shortcut, status }) =>
    commandHelper.command({
      label,
      shortcut,
      action: async (selection) => {
        const ids = Object.keys(selection);
        try {
          await sdk.client.fetch("/admin/reviews/status", {
            method: "POST",
            body: { ids, status },
          });
          toast.success(`Reviews ${status}`);
          refetch();
        } catch {
          toast.error(`Failed to ${label.toLowerCase()} reviews`);
        }
      },
    }),
  );
};

const limit = 15;

const statusColor = (status: Review["status"]): "green" | "red" | "grey" => {
  switch (status) {
    case "approved":
      return "green";
    case "flagged":
      return "red";
    default:
      return "grey";
  }
};

const ReviewDetailDrawer = ({
  review,
  open,
  onClose,
  onResponseChange,
}: {
  review: Review | null;
  open: boolean;
  onClose: () => void;
  onResponseChange: () => void;
}) => {
  const [responseContent, setResponseContent] = useState(
    review?.response?.content || "",
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!review) return;
    setIsSaving(true);
    try {
      await sdk.client.fetch(`/admin/reviews/${review.id}/response`, {
        method: "POST",
        body: { content: responseContent },
      });
      toast.success("Response saved");
      onResponseChange();
      onClose();
    } catch {
      toast.error("Failed to save response");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!review) return;
    setIsSaving(true);
    try {
      await sdk.client.fetch(`/admin/reviews/${review.id}/response`, {
        method: "DELETE",
      });
      toast.success("Response deleted");
      onResponseChange();
      onClose();
    } catch {
      toast.error("Failed to delete response");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Review Detail</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="space-y-4">
          {review && (
            <>
              <div>
                <Label>Rating</Label>
                <p className="txt-compact-small">{review.rating}/5</p>
              </div>
              {review.title && (
                <div>
                  <Label>Title</Label>
                  <p className="txt-compact-small">{review.title}</p>
                </div>
              )}
              <div>
                <Label>Content</Label>
                <p className="txt-compact-small">{review.content}</p>
              </div>
              <div>
                <Label>Purchase</Label>
                <p className="txt-compact-small">
                  {review.verified_purchase
                    ? "Verified purchase"
                    : "Not linked to a purchase"}
                </p>
              </div>
              <div className="border-t pt-4">
                <Label htmlFor="admin-response">Admin Response</Label>
                <Textarea
                  id="admin-response"
                  value={responseContent}
                  onChange={(e) => setResponseContent(e.target.value)}
                  rows={4}
                  className="mt-2"
                  placeholder="Write a response to this review..."
                />
              </div>
            </>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary" size="small">
              Cancel
            </Button>
          </Drawer.Close>
          {review?.response && (
            <Button
              variant="danger"
              size="small"
              onClick={handleDelete}
              isLoading={isSaving}
            >
              Delete
            </Button>
          )}
          <Button
            variant="primary"
            size="small"
            onClick={handleSave}
            disabled={isSaving || !responseContent.trim()}
            isLoading={isSaving}
          >
            {review?.response ? "Update" : "Save"} Response
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

const ReviewsPage = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageSize: limit,
    pageIndex: 0,
  });

  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>(
    {},
  );
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);

  const columns = useMemo(
    () => [
      columnHelper.select(),
      columnHelper.accessor("id", {
        header: "ID",
      }),
      columnHelper.accessor("title", {
        header: "Title",
      }),
      columnHelper.accessor("rating", {
        header: "Rating",
      }),
      columnHelper.accessor("content", {
        header: "Content",
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge color={statusColor(row.original.status)}>
            {row.original.status.charAt(0).toUpperCase() +
              row.original.status.slice(1)}
          </StatusBadge>
        ),
      }),
      columnHelper.accessor("response", {
        header: "Response",
        cell: ({ row }) => {
          return row.original.response ? (
            <StatusBadge color="green">Responded</StatusBadge>
          ) : (
            <StatusBadge color="grey">No response</StatusBadge>
          );
        },
      }),
      columnHelper.accessor("verified_purchase", {
        header: "Verified",
        cell: ({ row }) =>
          row.original.verified_purchase ? (
            <StatusBadge color="green">Verified</StatusBadge>
          ) : (
            <StatusBadge color="grey">Unverified</StatusBadge>
          ),
      }),
      columnHelper.accessor("product", {
        header: "Product",
        cell: ({ row }) => {
          return (
            <Link to={`/products/${row.original.product_id}`}>
              {row.original.product?.title}
            </Link>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => (
          <button
            onClick={() => setSelectedReview(row.original)}
            className="text-sm text-blue-600 hover:underline"
          >
            View
          </button>
        ),
      }),
    ],
    [],
  );

  const offset = pagination.pageIndex * limit;

  const { data, isLoading, refetch } = useQuery<{
    reviews: Review[];
    count: number;
    limit: number;
    offset: number;
  }>({
    queryKey: ["reviews", offset, limit],
    queryFn: () =>
      sdk.client.fetch("/admin/reviews", {
        query: {
          offset,
          limit,
          order: "-created_at",
        },
      }),
  });

  const commands = useCommands(refetch);

  const table = useDataTable({
    columns,
    data: data?.reviews || [],
    rowCount: data?.count || 0,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    commands,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: setRowSelection,
    },
    getRowId: (row) => row.id,
  });

  return (
    <Container>
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <Heading>Reviews</Heading>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
        <DataTable.CommandBar selectedLabel={(count) => `${count} selected`} />
      </DataTable>
      <Toaster />
      <ReviewDetailDrawer
        key={selectedReview?.id}
        review={selectedReview}
        open={!!selectedReview}
        onClose={() => setSelectedReview(null)}
        onResponseChange={refetch}
      />
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Reviews",
  icon: ChatBubbleLeftRight,
});

export default ReviewsPage;
