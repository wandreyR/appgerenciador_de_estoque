import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { LicenseGate } from "./components/License";
import { ToastProvider } from "./components/Toast";
import Categories from "./pages/Categories";
import Customers from "./pages/Customers";
import Dashboard from "./pages/Dashboard";
import NewOrder from "./pages/NewOrder";
import OrderDetail from "./pages/OrderDetail";
import OrderPrint from "./pages/OrderPrint";
import Orders from "./pages/Orders";
import ProductForm from "./pages/ProductForm";
import Products from "./pages/Products";
import SettingsPage from "./pages/Settings";
import Stock from "./pages/Stock";

export default function App() {
  return (
    <ToastProvider>
      <LicenseGate>
        <HashRouter>
          <Routes>
            <Route path="/pedidos/:id/imprimir" element={<OrderPrint />} />
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="produtos" element={<Products />} />
              <Route path="produtos/novo" element={<ProductForm />} />
              <Route path="produtos/:id" element={<ProductForm />} />
              <Route path="pedidos" element={<Orders />} />
              <Route path="pedidos/novo" element={<NewOrder />} />
              <Route path="pedidos/:id" element={<OrderDetail />} />
              <Route path="estoque" element={<Stock />} />
              <Route path="clientes" element={<Customers />} />
              <Route path="categorias" element={<Categories />} />
              <Route path="configuracoes" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </LicenseGate>
    </ToastProvider>
  );
}
