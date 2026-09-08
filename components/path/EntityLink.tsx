"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { type EntityRef, buildCanonicalEntityPath } from "@/lib/navigation";

export interface EntityLinkProps {
  entity: EntityRef;
  className?: string;
  children?: ReactNode;
  showIcon?: boolean;
  onClick?: (entity: EntityRef) => void;
}

export function EntityLink({ entity, className = "", children, showIcon = false, onClick }: EntityLinkProps) {
  const href = buildCanonicalEntityPath(entity);
  const displayText = children ?? entity.title ?? entity.code ?? entity.id;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      e.preventDefault();
      onClick(entity);
    }
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      data-entity-kind={entity.kind}
      data-entity-id={entity.id}
      className={`inline-flex items-center gap-1.5 font-bold text-teal-800 hover:text-teal-900 hover:underline ${className}`}
    >
      {showIcon && <span className="text-[10px] font-mono uppercase text-slate-500">[{entity.kind}]</span>}
      <span>{displayText}</span>
    </Link>
  );
}
