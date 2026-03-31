"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

interface SearchButtonProps {
  onClick: () => void;
}

export function SearchButton({ onClick }: SearchButtonProps) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="group flex cursor-pointer items-center gap-x-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
    >
      <MagnifyingGlassIcon className="h-5 w-5 flex-none text-gray-400 group-hover:text-gray-500" />
      <span className="flex-auto">Search products...</span>
      <kbd className="ml-auto flex h-5 items-center gap-x-1 rounded border border-gray-200 px-1.5 font-sans text-[10px] font-medium text-gray-400 group-hover:border-gray-300">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
