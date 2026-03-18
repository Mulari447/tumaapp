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
import billPaymentImage from "@/assets/bill-payment-service.jpg";
import queueImage from "@/assets/queue-service.jpg";
import movingImage from "@/assets/moving-service.jpg";
import documentImage from "@/assets/document-service.jpg";
import personalTasksImage from "@/assets/personal-tasks-service.jpg";

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
    image: billPaymentImage,
  },
  {
    icon: Clock,
    title: "Queue for You",
    description: "Stand in line at government offices, banks, or service centers",
    image: queueImage,
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
    image: movingImage,
  },
  {
    icon: FileText,
    title: "Document Runs",
    description: "Collect or submit documents, permits, or paperwork anywhere",
    image: documentImage,
  },
  {
    icon: Users,
    title: "Personal Tasks",
    description: "Any other task you need help with — just describe it",
    image: personalTasksImage,
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="group bg-card rounded-2xl overflow-hidden border border-border hover:shadow-xl transition-all duration-300"
              >
                <div className="aspect-video overflow-hidden">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{service.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {service.description}
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

export default Services;
