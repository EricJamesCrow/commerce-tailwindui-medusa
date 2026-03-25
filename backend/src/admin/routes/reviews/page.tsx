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
  onClose,
  onResponseChange,
}: {
  review: Review | null;
  onClose: () => void;
  onResponseChange: () => void;
}) => {
  const [responseContent, setResponseContent] = useState(
    review?.response?.content || "",
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!review) return null;

  const handleSave = async () => {
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
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <Heading level="h2">Review Detail</Heading>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Rating</p>
            <p className="text-sm">{review.rating}/5</p>
          </div>
          {review.title && (
            <div>
              <p className="text-sm font-medium text-gray-500">Title</p>
              <p className="text-sm">{review.title}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-500">Content</p>
            <p className="text-sm">{review.content}</p>
          </div>
          <hr />
          <div>
            <p className="text-sm font-medium text-gray-500">Admin Response</p>
            <textarea
              value={responseContent}
              onChange={(e) => setResponseContent(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Write a response to this review..."
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving || !responseContent.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {review.response ? "Update" : "Save"} Response
              </button>
              {review.response && (
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
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
      {selectedReview && (
        <ReviewDetailDrawer
          key={selectedReview.id}
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          onResponseChange={refetch}
        />
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Reviews",
  icon: ChatBubbleLeftRight,
});

export default ReviewsPage;
