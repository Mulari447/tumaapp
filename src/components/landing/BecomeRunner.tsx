import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { DollarSign, Calendar, MapPin, Star, ArrowRight } from "lucide-react";

const benefits = [
  {
    icon: DollarSign,
    title: "Earn on Your Terms",
    description: "Set your own rates and keep up to 85% of every job",
  },
  {
    icon: Calendar,
    title: "Flexible Schedule",
    description: "Work when you want, as much or as little as you need",
  },
  {
    icon: MapPin,
    title: "Work Locally",
    description: "Accept jobs in your neighborhood or preferred areas",
  },
  {
    icon: Star,
    title: "Build Your Reputation",
    description: "Great reviews lead to more jobs and higher earnings",
  },
];

const BecomeRunner = () => {
  return (
    <section id="become-runner" className="py-20 md:py-28 bg-foreground text-background">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block text-primary font-semibold mb-4">
              Earn Extra Income
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Become an Errand Runner
            </h2>
            <p className="text-lg text-background/70 mb-8 leading-relaxed">
              Join hundreds of Nairobians already earning flexible income by helping 
              their community. Whether you're a student, freelancer, or looking for 
              extra income — City Errands Ke connects you with people who need help.
            </p>
            
            <Button variant="hero" size="xl" className="group" asChild>
              <Link to="/auth">
                Start Earning Today
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </motion.div>

          {/* Right - Benefits Grid */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid sm:grid-cols-2 gap-6"
          >
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              
              return (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                  className="bg-background/5 backdrop-blur-sm rounded-2xl p-6 border border-background/10"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-background mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-background/60">
                    {benefit.description}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BecomeRunner;
