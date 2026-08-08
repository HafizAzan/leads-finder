"use client";
import EmptyPlaceholder from "@/app/components/common/empty-placeholder";
import Search from "@/app/components/common/search";
import Button from "@/app/components/ui/button";
import Modal from "@/app/components/ui/modal";
import Pagination from "@/app/components/ui/pagination";
import Table from "@/app/components/ui/table";
import { generateLeadsColumns, generateLeadsData, TableButtons } from "@/app/data/leads-data";
import { Download, Trash2, Upload, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

function Home() {
  const router = useRouter();
  const rowsPerPage = 5;
  const [searchValue, setSearchValue] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [open, setOpen] = useState<boolean>(false);

  const onModalOpen = (id: number) => {
    setOpen(true);
    setSelectedRows([id]);
  };

  const onModalClose = () => {
    setOpen(false);
    setSelectedRows([]);
  };

  const onRowDelete = () => {
    onModalClose();
  };

  const columns = generateLeadsColumns(onModalOpen);
  const data = generateLeadsData();

  const onPageChange = (page: number) => {
    setPage(page);
    setSelectedRows([]);
  };

  const filteredData = data?.filter((row) => {
    return Object?.values(row)?.some((val) => {
      const cellText = typeof val === "object" && val !== null && "props" in val ? (val.props as { text: string })?.text : val;
      return String(cellText).toLowerCase().includes(searchValue?.toLowerCase());
    });
  });

  const totalPage = Math.max(1, Math.ceil((filteredData?.length || 0) / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

  const currentData = filteredData?.slice(startIndex, endIndex);
  const hasSourceData = data?.length > 0;
  const hasFilteredData = filteredData?.length > 0;
  const isSearchEmpty = hasSourceData && !hasFilteredData && searchValue.trim().length > 0;
  const isListEmpty = !hasSourceData;

  const tableButtons: TableButtons[] =
    selectedRows?.length > 0
      ? [
          {
            label: `${selectedRows?.length} Selected`,
            shortLabel: `${selectedRows?.length}`,
          },
          {
            label: "Bulk Delete",
            shortLabel: "Delete",
            icon: <Trash2 className="size-3.5" />,
            onClick: () => setOpen(true),
          },
        ]
      : [
          {
            label: "Upload CSV",
            shortLabel: "Upload",
            icon: <Upload className="size-3.5" />,
            onClick: () => {},
          },
          {
            label: "Download CSV",
            shortLabel: "Download",
            icon: <Download className="size-3.5" />,
            onClick: () => {},
          },
          {
            label: "Generate New Leads",
            shortLabel: "Generate",
            icon: <UsersRound className="size-3.5" />,
            onClick: () => router.push("/leads/generate-leads"),
          },
        ];

  return (
    <section className="px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex flex-col gap-3 pb-4 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Search
          onChange={(val: string) => {
            setSearchValue(val);
            setPage(1);
            setSelectedRows([]);
          }}
          value={searchValue}
        />

        <div className="flex w-full flex-wrap items-center gap-1 rounded-lg bg-card p-1.5 sm:w-auto sm:gap-2 sm:p-2">
          {tableButtons?.map((single: TableButtons, index: number) => (
            <div className="flex min-w-0 items-center gap-1 sm:gap-2" key={index}>
              {index !== 0 && <div className="hidden h-5 w-px bg-border sm:block" />}
              <Button
                onClick={single.onClick}
                className="border-transparent px-2! py-1.5! text-xs! gap-x-1 sm:px-3! sm:text-sm!"
              >
                {single.icon && <span className="shrink-0">{single.icon}</span>}
                <span className="sm:hidden">{single.shortLabel ?? single.label}</span>
                <span className="hidden sm:inline">{single.label}</span>
              </Button>
            </div>
          ))}
        </div>
      </div>

      {isListEmpty ? (
        <EmptyPlaceholder
          variant="empty"
          actionLabel="Generate New Leads"
          onAction={() => router.push("/leads/generate-leads")}
        />
      ) : isSearchEmpty ? (
        <EmptyPlaceholder
          variant="search"
          actionLabel="Clear search"
          onAction={() => {
            setSearchValue("");
            setPage(1);
          }}
        />
      ) : (
        <>
          <Table columns={columns} data={currentData} selectedRows={selectedRows} setSelectedRows={setSelectedRows} />
          <Pagination currentPage={page} totalPages={totalPage} onPageChange={onPageChange} />
        </>
      )}

      <Modal
        open={open}
        onClose={onModalClose}
        title="Delete Lead"
        description={`You’re about to delete ${selectedRows?.length} selected leads. This action cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button onClick={onModalClose} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button onClick={onRowDelete} className="flex-1 bg-red-600 border-red-600 sm:flex-none">
              Delete
            </Button>
          </>
        }
      />
    </section>
  );
}

export default React.memo(Home);
