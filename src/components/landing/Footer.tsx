import { MapPin, Mail, Phone } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">E</span>
              </div>
              <span className="font-display font-bold text-xl">Errandi</span>
            </div>
            <p className="text-background/60 text-sm mb-6">
              Nairobi's trusted errand services marketplace. Connecting those who need help with verified local runners.
            </p>
            <div className="flex items-center gap-2 text-sm text-background/60">
              <MapPin className="w-4 h-4" />
              <span>Nairobi, Kenya</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-3 text-sm text-background/60">
              <li><a href="#how-it-works" className="hover:text-background transition-colors">How It Works</a></li>
              <li><a href="#services" className="hover:text-background transition-colors">Services</a></li>
              <li><a href="#become-runner" className="hover:text-background transition-colors">Become a Runner</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Pricing</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-3 text-sm text-background/60">
              <li><a href="#" className="hover:text-background transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Safety Guidelines</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Privacy Policy</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm text-background/60">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <a href="mailto:hello@errandi.co.ke" className="hover:text-background transition-colors">
                  hello@errandi.co.ke
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <a href="tel:+254700000000" className="hover:text-background transition-colors">
                  +254 700 000 000
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-background/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-background/40">
            © 2026 Errandi. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-sm text-background/60">Payments powered by</span>
            <div className="flex items-center gap-1 bg-secondary/20 px-3 py-1.5 rounded-lg">
              <span className="font-semibold text-secondary text-sm">M-Pesa</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
