"use client";
import Search from "@/app/components/common/search";
import Pagination from "@/app/components/ui/pagination";
import Table from "@/app/components/ui/table";
import { generateLeadsColumns, generateLeadsData } from "@/app/data/leads-data";
import React, { useState } from "react";

function Home() {
  const rowsPerPage = 5;
  const [searchValue, setSearchValue] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const columns = generateLeadsColumns();
  const data = generateLeadsData();

  const onPageChange = (page: number) => setPage(page);

  const totalPage = Math.ceil(data?.length / rowsPerPage);
  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

  const currentData = data?.slice(startIndex, endIndex);

  return (
    <section className="px-4 py-4">
      <div className="pb-4">
        <Search
          onChange={(val: string) => setSearchValue(val)}
          value={searchValue}
        />
      </div>
      <Table columns={columns} data={currentData} />
      <Pagination
        currentPage={page}
        totalPages={totalPage}
        onPageChange={onPageChange}
      />
    </section>
  );
}

export default React.memo(Home);
