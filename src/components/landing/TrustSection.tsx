import { motion } from "framer-motion";
import { Shield, UserCheck, CreditCard, MessageCircle, Star, Lock } from "lucide-react";

const trustFeatures = [
  {
    icon: UserCheck,
    title: "ID Verified Runners",
    description: "Every runner is verified with National ID and phone number checks",
  },
  {
    icon: CreditCard,
    title: "Secure M-Pesa Payments",
    description: "Funds held safely in escrow until you confirm task completion",
  },
  {
    icon: Star,
    title: "Ratings & Reviews",
    description: "Transparent feedback system helps you choose trusted runners",
  },
  {
    icon: MessageCircle,
    title: "In-App Messaging",
    description: "Communicate directly with your runner throughout the task",
  },
  {
    icon: Lock,
    title: "Dispute Resolution",
    description: "Our team is here to help if anything doesn't go as planned",
  },
  {
    icon: Shield,
    title: "Task Tracking",
    description: "Follow your errand's progress from acceptance to completion",
  },
];

const TrustSection = () => {
  return (
    <section className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-full px-4 py-2 mb-6">
            <Shield className="w-4 h-4 text-secondary" />
            <span className="text-sm font-medium text-secondary">Trust & Safety</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Your Safety Is Our Priority
          </h2>
          <p className="text-lg text-muted-foreground">
            We've built multiple layers of trust and accountability to ensure every transaction is safe and reliable.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trustFeatures.map((feature, index) => {
            const Icon = feature.icon;
            
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
