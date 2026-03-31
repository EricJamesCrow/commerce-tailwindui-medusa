"use client";

import type { HttpTypes } from "@medusajs/types";
import { useState } from "react";
import { AddressCard } from "./address-card";
import { AddressForm } from "./address-form";

type AddressesClientProps = {
  addresses: HttpTypes.StoreCustomerAddress[];
};

export function AddressesClient({ addresses }: AddressesClientProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div>
      <div className="mb-6">
        <button
          type="button"
          onClick={() => {
            setShowAddForm(true);
            setEditingId(null);
          }}
          className="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 cursor-pointer rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Add new address
        </button>
      </div>

      {showAddForm && (
        <div className="mb-8 rounded-lg border border-gray-200 p-6">
          <h3 className="mb-4 text-sm font-medium text-gray-900">
            New address
          </h3>
          <AddressForm onClose={() => setShowAddForm(false)} />
        </div>
      )}

      {addresses.length === 0 && !showAddForm ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-500">
            You don&apos;t have any saved addresses yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {addresses.map((address) =>
            editingId === address.id ? (
              <div
                key={address.id}
                className="rounded-lg border border-gray-200 p-6"
              >
                <h3 className="mb-4 text-sm font-medium text-gray-900">
                  Edit address
                </h3>
                <AddressForm
                  address={address}
                  onClose={() => setEditingId(null)}
                />
              </div>
            ) : (
              <AddressCard
                key={address.id}
                address={address}
                onEdit={() => {
                  setEditingId(address.id);
                  setShowAddForm(false);
                }}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
