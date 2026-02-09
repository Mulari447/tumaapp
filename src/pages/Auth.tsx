import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { Loader2, User, Bike, ArrowLeft, Footprints, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number is too long')
    .regex(/^(\+254|0)[17]\d{8}$/, 'Please enter a valid Kenyan phone number (e.g., 0712345678 or +254712345678)'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  userType: z.enum(['customer', 'runner']),
  transportType: z.enum(['foot', 'motorbike']).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
}).refine((data) => {
  if (data.userType === 'runner' && !data.transportType) {
    return false;
  }
  return true;
}, {
  message: 'Please select your transport type',
  path: ['transportType'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  
  // OTP verification state
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [generatedOTP, setGeneratedOTP] = useState('');
  const [pendingSignupData, setPendingSignupData] = useState<SignupFormData | null>(null);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      userType: 'customer',
      transportType: undefined,
    },
  });

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const sendOTPEmail = async (email: string, otp: string) => {
    setSendingOTP(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { email, otp },
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      return true;
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      throw error;
    } finally {
      setSendingOTP(false);
    }
  };

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password. Please try again.');
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      // Generate OTP and send to email
      const otp = generateOTP();
      setGeneratedOTP(otp);
      setPendingSignupData(data);

      await sendOTPEmail(data.email, otp);
      
      setShowOTPVerification(true);
      setOtpSent(true);
      toast.success('Verification code sent to your email!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpValue !== generatedOTP) {
      toast.error('Invalid verification code. Please try again.');
      return;
    }

    if (!pendingSignupData) {
      toast.error('Session expired. Please try again.');
      setShowOTPVerification(false);
      return;
    }

    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      const data = pendingSignupData;

      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: data.fullName,
            phone: data.phone,
            user_type: data.userType,
            transport_type: data.userType === 'runner' ? data.transportType : null,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please log in instead.');
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success('Account created successfully!');
      
      if (data.userType === 'runner') {
        navigate('/verify-documents');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!pendingSignupData) return;
    
    try {
      const otp = generateOTP();
      setGeneratedOTP(otp);
      await sendOTPEmail(pendingSignupData.email, otp);
      setOtpValue('');
      toast.success('New verification code sent!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend code. Please try again.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // OTP Verification Screen
  if (showOTPVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted flex flex-col">
        <header className="p-4">
          <button
            onClick={() => {
              setShowOTPVerification(false);
              setOtpValue('');
            }}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <Card className="border-0 shadow-xl bg-card/95 backdrop-blur">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Verify Your Email</CardTitle>
                <CardDescription>
                  We've sent a 6-digit verification code to<br />
                  <span className="font-medium text-foreground">{pendingSignupData?.email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpValue}
                    onChange={setOtpValue}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button
                  onClick={handleVerifyOTP}
                  className="w-full"
                  disabled={otpValue.length !== 6 || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Create Account'
                  )}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Didn't receive the code?
                  </p>
                  <Button
                    variant="link"
                    onClick={handleResendOTP}
                    disabled={sendingOTP}
                    className="text-primary"
                  >
                    {sendingOTP ? 'Sending...' : 'Resend Code'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted flex flex-col">
      {/* Header */}
      <header className="p-4">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="border-0 shadow-xl bg-card/95 backdrop-blur">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">CE</span>
                </div>
                <span className="text-2xl font-bold">City Errands <span className="text-primary">Ke</span></span>
              </div>
              <CardTitle className="text-xl">Welcome</CardTitle>
              <CardDescription>
                {activeTab === 'login' 
                  ? 'Sign in to your account to continue'
                  : 'Create an account to get started'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                {/* Login Tab */}
                <TabsContent value="login">
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        {...loginForm.register('email')}
                      />
                      {loginForm.formState.errors.email && (
                        <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        {...loginForm.register('password')}
                      />
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* Signup Tab */}
                <TabsContent value="signup">
                  <form onSubmit={signupForm.handleSubmit(handleSignupSubmit)} className="space-y-4">
                    {/* User Type Selection */}
                    <div className="space-y-3">
                      <Label>I want to...</Label>
                      <RadioGroup
                        value={signupForm.watch('userType')}
                        onValueChange={(value) => signupForm.setValue('userType', value as 'customer' | 'runner')}
                        className="grid grid-cols-2 gap-4"
                      >
                        <div>
                          <RadioGroupItem
                            value="customer"
                            id="customer"
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor="customer"
                            className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                          >
                            <User className="mb-2 h-6 w-6" />
                            <span className="text-sm font-medium">Post Errands</span>
                          </Label>
                        </div>
                        <div>
                          <RadioGroupItem
                            value="runner"
                            id="runner"
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor="runner"
                            className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                          >
                            <Bike className="mb-2 h-6 w-6" />
                            <span className="text-sm font-medium">Run Errands</span>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        placeholder="John Doe"
                        {...signupForm.register('fullName')}
                      />
                      {signupForm.formState.errors.fullName && (
                        <p className="text-sm text-destructive">{signupForm.formState.errors.fullName.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        {...signupForm.register('email')}
                      />
                      {signupForm.formState.errors.email && (
                        <p className="text-sm text-destructive">{signupForm.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+254 7XX XXX XXX"
                        {...signupForm.register('phone')}
                      />
                      {signupForm.formState.errors.phone && (
                        <p className="text-sm text-destructive">{signupForm.formState.errors.phone.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        {...signupForm.register('password')}
                      />
                      {signupForm.formState.errors.password && (
                        <p className="text-sm text-destructive">{signupForm.formState.errors.password.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        {...signupForm.register('confirmPassword')}
                      />
                      {signupForm.formState.errors.confirmPassword && (
                        <p className="text-sm text-destructive">{signupForm.formState.errors.confirmPassword.message}</p>
                      )}
                    </div>

                    {signupForm.watch('userType') === 'runner' && (
                      <div className="space-y-3">
                        <Label>Transport Type</Label>
                        <RadioGroup
                          value={signupForm.watch('transportType')}
                          onValueChange={(value) => signupForm.setValue('transportType', value as 'foot' | 'motorbike')}
                          className="grid grid-cols-2 gap-4"
                        >
                          <div>
                            <RadioGroupItem
                              value="foot"
                              id="foot"
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor="foot"
                              className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                            >
                              <Footprints className="mb-2 h-6 w-6" />
                              <span className="text-sm font-medium">On Foot</span>
                            </Label>
                          </div>
                          <div>
                            <RadioGroupItem
                              value="motorbike"
                              id="motorbike"
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor="motorbike"
                              className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                            >
                              <Bike className="mb-2 h-6 w-6" />
                              <span className="text-sm font-medium">Motorbike</span>
                            </Label>
                          </div>
                        </RadioGroup>
                        {signupForm.formState.errors.transportType && (
                          <p className="text-sm text-destructive">{signupForm.formState.errors.transportType.message}</p>
                        )}
                        <p className="text-sm text-muted-foreground bg-accent/50 p-3 rounded-lg">
                          📋 As a runner, you'll need to verify your ID after signing up.
                          {signupForm.watch('transportType') === 'motorbike' && ' Motorbike riders must also upload a driving license.'}
                        </p>
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={isLoading || sendingOTP}>
                      {isLoading || sendingOTP ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {sendingOTP ? 'Sending verification code...' : 'Creating account...'}
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
