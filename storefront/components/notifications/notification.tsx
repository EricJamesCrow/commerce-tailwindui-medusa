"use client";

import { Transition } from "@headlessui/react";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { useNotification } from "./notification-context";

export function NotificationContainer() {
  const { notifications, dismissNotification, removeNotification } =
    useNotification();

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-end px-4 py-6 sm:p-6"
    >
      <div className="flex w-full flex-col items-end gap-y-4">
        {notifications.map((notification) => (
          <Transition
            key={notification.id}
            show={notification.visible}
            appear
            afterLeave={() => removeNotification(notification.id)}
            enter="transition duration-300 ease-out"
            enterFrom="translate-x-full opacity-0"
            enterTo="translate-x-0 opacity-100"
            leave="transition duration-100 ease-in"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5">
              <div className="p-4">
                <div className="flex items-start">
                  <div className="shrink-0">
                    {notification.type === "success" ? (
                      <CheckCircleIcon className="size-6 text-green-400" />
                    ) : (
                      <XCircleIcon className="size-6 text-red-400" />
                    )}
                  </div>
                  <div className="ml-3 w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-gray-900">
                      {notification.title}
                    </p>
                    {notification.message && (
                      <p className="mt-1 text-sm text-gray-500">
                        {notification.message}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex shrink-0">
                    <button
                      type="button"
                      onClick={() => dismissNotification(notification.id)}
                      className="focus:ring-primary-500 inline-flex cursor-pointer rounded-md bg-white text-gray-400 hover:text-gray-500 focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="size-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        ))}
      </div>
    </div>
  );
}
