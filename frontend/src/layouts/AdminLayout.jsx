import React from "react";
import { Outlet } from "react-router-dom";

const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Outlet />
    </div>
  );
};

export default AdminLayout;