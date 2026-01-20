import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Loader2, 
  LogOut, 
  User, 
  Shield, 
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  FileText,
  Plus
} from 'lucide-react';

type VerificationStatus = 'pending' | 'under_review' | 'verified' | 'rejected';
type UserType = 'customer' | 'runner';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  user_type: UserType;
  verification_status: VerificationStatus;
  location: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;
        setProfile(data);
      } catch (error: any) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
      // Check admin status
      supabase.rpc('is_admin').then(({ data }) => {
        setIsAdmin(!!data);
      });
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/');
  };

  const getVerificationBadge = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return (
          <Badge className="bg-success text-success-foreground">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Verified
          </Badge>
        );
      case 'under_review':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Under Review
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-light via-background to-sand-light">
      {/* Header */}
      <header className="p-4 border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-primary">Errandi</Link>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
                <Shield className="h-4 w-4 mr-2" />
                Admin
              </Button>
            )}
            <span className="text-sm text-muted-foreground hidden sm:block">
              {profile?.email}
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}! 👋
            </h1>
            <p className="text-muted-foreground">
              {profile?.user_type === 'runner' 
                ? 'Manage your runner profile and find errands to complete'
                : 'Post errands and track your requests'
              }
            </p>
          </div>

          {/* Profile Card */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Your Profile</CardTitle>
                    <CardDescription>
                      {profile?.user_type === 'runner' ? 'Errand Runner' : 'Customer'}
                    </CardDescription>
                  </div>
                </div>
                {profile?.user_type === 'runner' && getVerificationBadge(profile.verification_status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{profile?.full_name || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{profile?.phone || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{profile?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{profile?.location || 'Not set'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Runner Verification Card */}
          {profile?.user_type === 'runner' && profile.verification_status === 'pending' && (
            <Card className="mb-6 border-primary/50 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Complete Your Verification</CardTitle>
                    <CardDescription>
                      Upload your ID documents to start accepting errands
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  To ensure trust and safety, all runners must verify their identity. 
                  This typically takes 1-2 business days.
                </p>
                <Button onClick={() => navigate('/verify-documents')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Upload Documents
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Under Review Card */}
          {profile?.user_type === 'runner' && profile.verification_status === 'under_review' && (
            <Card className="mb-6 border-yellow-500/50 bg-yellow-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Clock className="h-10 w-10 text-yellow-600" />
                  <div>
                    <h3 className="font-semibold">Verification In Progress</h3>
                    <p className="text-sm text-muted-foreground">
                      We're reviewing your documents. This usually takes 1-2 business days.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Verified Card */}
          {profile?.user_type === 'runner' && profile.verification_status === 'verified' && (
            <Card className="mb-6 border-success/50 bg-success/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                  <div>
                    <h3 className="font-semibold">You're Verified! 🎉</h3>
                    <p className="text-sm text-muted-foreground">
                      You can now browse and accept errands in your area.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="grid gap-4 sm:grid-cols-2">
            {profile?.user_type === 'customer' ? (
              <>
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate('/post-errand')}
                >
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Plus className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Post an Errand</h3>
                      <p className="text-sm text-muted-foreground">
                        Create a new errand request
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate('/my-errands')}
                >
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">My Errands</h3>
                      <p className="text-sm text-muted-foreground">
                        View your errand history
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate('/errands-marketplace')}
                >
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Available Errands</h3>
                      <p className="text-sm text-muted-foreground">
                        Browse errands near you
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">My Jobs</h3>
                      <p className="text-sm text-muted-foreground">
                        View your completed jobs
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
