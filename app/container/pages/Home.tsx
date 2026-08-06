import Table from "@/app/components/ui/table";
import { generateLeadsColumns, generateLeadsData } from "@/app/data/leads-data";
import React from "react";

function Home() {
  const columns = generateLeadsColumns();
  const data = generateLeadsData();

  return (
    <section className="px-4 py-4">
      <Table columns={columns} data={data} />
    </section>
  );
}

export default React.memo(Home);
