"use client";
import Search from "@/app/components/common/search";
import Button from "@/app/components/ui/button";
import Modal from "@/app/components/ui/modal";
import Pagination from "@/app/components/ui/pagination";
import Table from "@/app/components/ui/table";
import { generateLeadsColumns, generateLeadsData, TableButtons } from "@/app/data/leads-data";
import { Download, Trash2, Upload, UsersRound } from "lucide-react";
import React, { useState } from "react";

function Home() {
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
      const cellText = typeof val === "object" && val !== null && "props" in val ? (val.props as any)?.text : val;
      return String(cellText).toLowerCase().includes(searchValue?.toLowerCase());
    });
  });

  const totalPage = Math.ceil(filteredData?.length / rowsPerPage);
  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

  const currentData = filteredData?.slice(startIndex, endIndex);

  const tableButtons: TableButtons[] =
    selectedRows?.length > 0
      ? [
          {
            label: `${selectedRows?.length} Leads Selected`,
          },
          {
            label: "Bulk Delete",
            icon: <Trash2 className="size-3.5" />,
            onClick: () => setOpen(true),
          },
        ]
      : [
          {
            label: "Upload CSV",
            icon: <Upload className="size-3.5" />,
            onClick: () => {},
          },
          {
            label: "Download CSV",
            icon: <Download className="size-3.5" />,
            onClick: () => {},
          },
          {
            label: "Generate New Leads",
            icon: <UsersRound className="size-3.5" />,
            onClick: () => {},
          },
        ];

  return (
    <section className="px-4 py-4">
      <div className="flex items-end justify-between pb-4">
        <Search onChange={(val: string) => setSearchValue(val)} value={searchValue} />
        <div className="flex gap-4 bg-card p-2 rounded-sm">
          {tableButtons?.map((single: TableButtons, index: number) => (
            <div className="flex items-center gap-2" key={index}>
              {index !== 0 && <div className="h-full w-px bg-white" />}
              <Button onClick={single.onClick} className="border-transparent p-0! gap-x-1">
                <span>{single.icon}</span>
                {single.label}
              </Button>
            </div>
          ))}
        </div>
      </div>
      <Table columns={columns} data={currentData} selectedRows={selectedRows} setSelectedRows={setSelectedRows} />
      <Pagination currentPage={page} totalPages={totalPage} onPageChange={onPageChange} />

      <Modal
        open={open}
        onClose={onModalClose}
        title="Delete Lead"
        description={`You’re about to delete ${selectedRows?.length} selected leads. This action cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button onClick={onModalClose}>Cancel</Button>
            <Button onClick={onRowDelete} className="bg-red-600 border-red-600">
              Delete
            </Button>
          </>
        }
      />
    </section>
  );
}

export default React.memo(Home);
