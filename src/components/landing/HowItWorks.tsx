import { motion } from "framer-motion";
import { ClipboardList, UserCheck, CheckCircle } from "lucide-react";

const steps = [
  {
    icon: ClipboardList,
    title: "Post Your Errand",
    description: "Describe what you need done — shopping, delivery, bill payment, queuing, or any task. Set your location and preferred time.",
    color: "primary" as const,
  },
  {
    icon: UserCheck,
    title: "Get Matched",
    description: "View available verified runners near you. Check their ratings, reviews, and skills. Choose the best fit for your task.",
    color: "secondary" as const,
  },
  {
    icon: CheckCircle,
    title: "Task Completed",
    description: "Track progress in real-time. Pay securely via M-Pesa once satisfied. Rate your runner to help the community.",
    color: "accent" as const,
  },
];

const colorClasses = {
  primary: {
    bg: "bg-primary/10",
    icon: "text-primary",
    number: "bg-primary text-primary-foreground",
  },
  secondary: {
    bg: "bg-secondary/10",
    icon: "text-secondary",
    number: "bg-secondary text-secondary-foreground",
  },
  accent: {
    bg: "bg-accent/10",
    icon: "text-accent",
    number: "bg-accent text-accent-foreground",
  },
};

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground">
            Getting your errands done is simple. Three easy steps and you're on your way.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const colors = colorClasses[step.color];
            
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="relative"
              >
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-border" />
                )}
                
                <div className="bg-card rounded-2xl p-8 border border-border shadow-sm hover:shadow-lg transition-shadow duration-300 relative">
                  {/* Step Number */}
                  <div className={`absolute -top-4 -left-4 w-8 h-8 rounded-full ${colors.number} flex items-center justify-center font-bold text-sm shadow-md`}>
                    {index + 1}
                  </div>
                  
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl ${colors.bg} flex items-center justify-center mb-6`}>
                    <Icon className={`w-8 h-8 ${colors.icon}`} />
                  </div>
                  
                  <h3 className="font-display text-xl font-bold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
