import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import VerifyDocuments from "./pages/VerifyDocuments";
import PostErrand from "./pages/PostErrand";
import MyErrands from "./pages/MyErrands";
import ErrandsMarketplace from "./pages/ErrandsMarketplace";
import Wallet from "./pages/Wallet";
import AdminDashboard from "./pages/AdminDashboard";
import AdminVerificationDetail from "./pages/AdminVerificationDetail";
import Contact from "./pages/Contact";
import RunnerDashboard from "./pages/RunnerDashboard";
import HouseListings from "./pages/HouseListings";
import PostHouseListing from "./pages/PostHouseListing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/verify-documents" element={<VerifyDocuments />} />
            <Route path="/post-errand" element={<PostErrand />} />
            <Route path="/my-errands" element={<MyErrands />} />
            <Route path="/errands-marketplace" element={<ErrandsMarketplace />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/verification/:userId" element={<AdminVerificationDetail />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/runner-dashboard" element={<RunnerDashboard />} />
            <Route path="/house-listings" element={<HouseListings />} />
            <Route path="/post-house-listing" element={<PostHouseListing />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
