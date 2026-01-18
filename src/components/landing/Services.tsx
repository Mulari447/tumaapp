import { motion } from "framer-motion";
import { 
  ShoppingCart, 
  Package, 
  FileText, 
  Sparkles, 
  Truck, 
  Clock,
  CreditCard,
  Users
} from "lucide-react";

const services = [
  {
    icon: ShoppingCart,
    title: "Shopping",
    description: "Groceries, supplies, personal items from any store in Nairobi",
  },
  {
    icon: Package,
    title: "Deliveries",
    description: "Pick up and deliver packages, documents, or goods across the city",
  },
  {
    icon: CreditCard,
    title: "Bill Payments",
    description: "Pay bills, utilities, or handle banking errands on your behalf",
  },
  {
    icon: Clock,
    title: "Queue for You",
    description: "Stand in line at government offices, banks, or service centers",
  },
  {
    icon: Sparkles,
    title: "Cleaning",
    description: "House cleaning, laundry pickup, or office tidying services",
  },
  {
    icon: Truck,
    title: "Moving Help",
    description: "Small moves, furniture assembly, or heavy lifting assistance",
  },
  {
    icon: FileText,
    title: "Document Runs",
    description: "Collect or submit documents, permits, or paperwork anywhere",
  },
  {
    icon: Users,
    title: "Personal Tasks",
    description: "Any other task you need help with — just describe it",
  },
];

const Services = () => {
  return (
    <section id="services" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            What We Can Do For You
          </h2>
          <p className="text-lg text-muted-foreground">
            From everyday tasks to specialized errands, our verified runners handle it all.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => {
            const Icon = service.icon;
            
            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                whileHover={{ y: -5 }}
                className="group bg-card rounded-2xl p-6 border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-4 transition-colors">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">
                  {service.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {service.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Services;
