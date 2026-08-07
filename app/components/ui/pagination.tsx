"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
};

function Pagination({ currentPage = 1, totalPages = 20, onPageChange }: PaginationProps) {
  const getPages = () => {
    if (totalPages <= 3) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 2) {
      return [1, 2, 3];
    }

    if (currentPage >= totalPages - 1) {
      return [totalPages - 2, totalPages - 1, totalPages];
    }

    return [currentPage - 1, currentPage, currentPage + 1];
  };

  const pages = getPages();

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange?.(page);
  };

  const showLeftDots = pages[0] > 1;
  const showRightDots = pages[pages.length - 1] < totalPages;

  return (
    <div className="mt-1 flex flex-col gap-3 rounded-2xl border-t border-border px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <p className="text-center text-sm text-muted sm:text-left">
        Page <span className="text-foreground">{currentPage}</span> of <span className="text-foreground">{totalPages}</span>
      </p>

      <div className="flex items-center justify-center gap-1 sm:justify-end">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted transition-colors hover:bg-sidebar hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>

        {showLeftDots && (
          <>
            <button
              type="button"
              onClick={() => handlePageChange(1)}
              className="flex h-8 min-w-8 items-center justify-center rounded-md border border-transparent px-2 text-sm text-muted transition-colors hover:border-border hover:bg-sidebar hover:text-foreground"
            >
              1
            </button>

            <span className="flex h-8 w-8 items-center justify-center text-muted">...</span>
          </>
        )}

        {/* Pages */}
        {pages.map((page) => {
          const isActive = page === currentPage;

          return (
            <button
              key={page}
              type="button"
              onClick={() => handlePageChange(page)}
              className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition-colors
                ${
                  isActive
                    ? "border-border bg-sidebar text-foreground"
                    : "border-transparent text-muted hover:border-border hover:bg-sidebar hover:text-foreground"
                }
              `}
            >
              {page}
            </button>
          );
        })}

        {showRightDots && (
          <>
            <span className="flex h-8 w-8 items-center justify-center text-muted">...</span>

            <button
              type="button"
              onClick={() => handlePageChange(totalPages)}
              className="
                flex h-8 min-w-8 items-center justify-center
                rounded-md border border-transparent
                px-2 text-sm text-muted
                transition-colors
                hover:border-border hover:bg-sidebar hover:text-foreground
              "
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
          className="
            flex h-8 w-8 items-center justify-center
            rounded-md border border-border bg-card
            text-muted transition-colors
            hover:bg-sidebar hover:text-foreground
            disabled:pointer-events-none disabled:opacity-40
          "
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

export default React.memo(Pagination);
