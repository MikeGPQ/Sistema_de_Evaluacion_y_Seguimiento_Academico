import React from "react";
import { Outlet } from "react-router-dom";

const DocenteLayout = () => {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Outlet />
    </div>
  );
};

export default DocenteLayout;