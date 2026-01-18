import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Clock, Shield } from "lucide-react";
import { motion } from "framer-motion";
import heroImage from "@/assets/hero-image.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen pt-20 md:pt-24 overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="Nairobi errand runner on motorcycle"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/60" />
      </div>

      <div className="container relative z-10 mx-auto px-4 py-12 md:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-8rem)]">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-xl"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-full px-4 py-2 mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-sm font-medium text-secondary">Now serving Nairobi</span>
            </motion.div>

            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Your errands,{" "}
              <span className="text-gradient">done for you</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              Connect with verified errand runners in Nairobi. From shopping to deliveries, 
              bill payments to queuing — we handle it all while you focus on what matters.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Button variant="hero" size="xl" asChild>
                <Link to="/auth">
                  Post an Errand
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="success" size="xl" asChild>
                <Link to="/auth">Become a Runner</Link>
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-2"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Local</p>
                  <p className="text-muted-foreground">Nairobi-based</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2"
              >
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-secondary" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Fast</p>
                  <p className="text-muted-foreground">Same day</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-2"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-accent" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Verified</p>
                  <p className="text-muted-foreground">ID checked</p>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right side - Stats card on larger screens */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="hidden lg:block"
          >
            <div className="bg-card/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-border max-w-sm ml-auto">
              <h3 className="font-semibold text-foreground mb-6">Trusted by Nairobians</h3>
              <div className="space-y-6">
                <div>
                  <p className="text-3xl font-bold text-primary">1,000+</p>
                  <p className="text-muted-foreground">Errands completed</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-secondary">500+</p>
                  <p className="text-muted-foreground">Verified runners</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-accent">4.9★</p>
                  <p className="text-muted-foreground">Average rating</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
