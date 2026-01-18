import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import Services from "@/components/landing/Services";
import TrustSection from "@/components/landing/TrustSection";
import BecomeRunner from "@/components/landing/BecomeRunner";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Services />
        <TrustSection />
        <BecomeRunner />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
