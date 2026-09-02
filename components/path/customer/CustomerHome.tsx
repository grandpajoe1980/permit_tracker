"use client";

import type { ReactNode } from "react";

type CustomerHomeProps = {
  projectName: string;
  onSubmitRequest: () => void;
  children: ReactNode;
};

/** Shared customer-home frame keeps the primary next action above project detail. */
export function CustomerHome({ projectName, onSubmitRequest, children }: CustomerHomeProps) {
  return (
    <div data-path-customer-home="true" className="space-y-6">
      <div className="sr-only"><p>{projectName}</p><button type="button" onClick={onSubmitRequest}>Submit a Request</button></div>
      {children}
    </div>
  );
}
