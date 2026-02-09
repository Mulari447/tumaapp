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
import deliveryImage from "@/assets/delivery-service.jpg";
import shoppingImage from "@/assets/shopping-service.jpg";
import cleaningImage from "@/assets/cleaning-service.jpg";

const services = [
  {
    icon: ShoppingCart,
    title: "Shopping",
    description: "Groceries, supplies, personal items from any store in Nairobi",
    image: shoppingImage,
  },
  {
    icon: Package,
    title: "Deliveries",
    description: "Pick up and deliver packages, documents, or goods across the city",
    image: deliveryImage,
  },
  {
    icon: CreditCard,
    title: "Bill Payments",
    description: "Pay bills, utilities, or handle banking errands on your behalf",
    image: null,
  },
  {
    icon: Clock,
    title: "Queue for You",
    description: "Stand in line at government offices, banks, or service centers",
    image: null,
  },
  {
    icon: Sparkles,
    title: "Cleaning",
    description: "House cleaning, laundry pickup, or office tidying services",
    image: cleaningImage,
  },
  {
    icon: Truck,
    title: "Moving Help",
    description: "Small moves, furniture assembly, or heavy lifting assistance",
    image: null,
  },
  {
    icon: FileText,
    title: "Document Runs",
    description: "Collect or submit documents, permits, or paperwork anywhere",
    image: null,
  },
  {
    icon: Users,
    title: "Personal Tasks",
    description: "Any other task you need help with — just describe it",
    image: null,
  },
];

const Services = () => {
  return (
    <section id="services" className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="text-primary font-semibold text-sm uppercase tracking-wider">Our Services</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mt-2 mb-4">
            What We Can Do For You
          </h2>
          <p className="text-lg text-muted-foreground">
            From everyday tasks to specialized errands, our verified runners handle it all.
          </p>
        </motion.div>

        {/* Featured Services with Images */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {services.filter(s => s.image).map((service, index) => {
            const Icon = service.icon;
            
            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="group bg-card rounded-2xl overflow-hidden border border-border hover:shadow-xl transition-all duration-300"
              >
                <div className="aspect-video overflow-hidden">
                  <img
                    src={service.image!}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{service.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Other Services Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {services.filter(s => !s.image).map((service, index) => {
            const Icon = service.icon;
            
            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                whileHover={{ y: -5 }}
                className="group bg-card rounded-xl p-5 border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-3 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1 text-sm">
                  {service.title}
                </h3>
                <p className="text-xs text-muted-foreground">
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
