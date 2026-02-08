import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Loader2, 
  Upload, 
  CheckCircle2, 
  Camera, 
  CreditCard, 
  ArrowLeft,
  ArrowRight,
  Shield,
  X,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LicenseUploadStep } from '@/components/verification/LicenseUploadStep';

interface UploadedFile {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
}

interface UserProfile {
  transport_type: string | null;
}

const VerifyDocuments = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  const [idFront, setIdFront] = useState<UploadedFile | null>(null);
  const [idBack, setIdBack] = useState<UploadedFile | null>(null);
  const [selfie, setSelfie] = useState<UploadedFile | null>(null);
  const [drivingLicense, setDrivingLicense] = useState<UploadedFile | null>(null);

  const requiresLicense = profile?.transport_type === 'motorbike';
  const totalSteps = requiresLicense ? 4 : 3;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    
    // Fetch user profile to check transport_type
    if (user) {
      supabase
        .from('profiles')
        .select('transport_type')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfile(data as UserProfile);
          }
        });
    }
  }, [user, authLoading, navigate]);

  const handleFileSelect = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
    setFile: React.Dispatch<React.SetStateAction<UploadedFile | null>>,
    fileType: 'id-front' | 'id-back' | 'selfie'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, or WebP image');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    const preview = URL.createObjectURL(file);
    setFile({ file, preview, uploading: true, uploaded: false });

    try {
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${fileType}-${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('id-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('id-documents')
        .getPublicUrl(fileName);

      setFile({
        file,
        preview,
        uploading: false,
        uploaded: true,
        url: urlData.publicUrl,
      });

      toast.success('Document uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload document');
      setFile(null);
    }
  }, [user]);

  const removeFile = (setFile: React.Dispatch<React.SetStateAction<UploadedFile | null>>) => {
    setFile(null);
  };

  const handleSubmitVerification = async () => {
    if (!user || !idFront?.url || !idBack?.url || !selfie?.url) {
      toast.error('Please upload all required documents');
      return;
    }

    // Check if motorbike runner needs license
    if (requiresLicense && !drivingLicense?.url) {
      toast.error('Please upload your driving license');
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData: Record<string, any> = {
        id_document_url: idFront.url,
        id_document_back_url: idBack.url,
        selfie_url: selfie.url,
        verification_status: 'under_review',
      };

      if (requiresLicense && drivingLicense?.url) {
        updateData.driving_license_url = drivingLicense.url;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Documents submitted for verification!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Submission error:', error);
      toast.error(error.message || 'Failed to submit documents');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = ((currentStep - 1) / totalSteps) * 100 + (
    (currentStep === 1 && idFront?.uploaded ? (100 / totalSteps) : 0) +
    (currentStep === 2 && idBack?.uploaded ? (100 / totalSteps) : 0) +
    (currentStep === 3 && selfie?.uploaded ? (100 / totalSteps) : 0) +
    (currentStep === 4 && drivingLicense?.uploaded ? (100 / totalSteps) : 0)
  );

  const canProceed = () => {
    switch (currentStep) {
      case 1: return idFront?.uploaded;
      case 2: return idBack?.uploaded;
      case 3: return selfie?.uploaded;
      case 4: return requiresLicense ? drivingLicense?.uploaded : true;
      default: return false;
    }
  };

  const isLastStep = requiresLicense ? currentStep === 4 : currentStep === 3;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderUploadCard = (
    title: string,
    description: string,
    icon: React.ReactNode,
    file: UploadedFile | null,
    setFile: React.Dispatch<React.SetStateAction<UploadedFile | null>>,
    fileType: 'id-front' | 'id-back' | 'selfie'
  ) => (
    <Card className="border-2 border-dashed border-muted hover:border-primary/50 transition-colors">
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center">
          {file?.preview ? (
            <div className="relative w-full">
              <img
                src={file.preview}
                alt={title}
                className="w-full h-48 object-cover rounded-lg"
              />
              {file.uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
              {file.uploaded && (
                <div className="absolute top-2 right-2 bg-success text-success-foreground p-1 rounded-full">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              )}
              {!file.uploading && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 left-2"
                  onClick={() => removeFile(setFile)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="p-4 bg-muted rounded-full mb-4">
                {icon}
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{description}</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, setFile, fileType)}
                />
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Photo
                  </span>
                </Button>
              </label>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-light via-background to-sand-light">
      {/* Header */}
      <header className="p-4 border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-primary">Errandi</Link>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            Skip for now
          </Button>
        </div>
      </header>

      {/* Progress */}
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Verification Progress</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Security Notice */}
        <Card className="mb-6 bg-accent/50 border-accent">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Your documents are secure</p>
              <p className="text-sm text-muted-foreground">
                We use end-to-end encryption to protect your personal information. 
                Documents are only used for verification purposes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold mb-2">Upload ID Front</h1>
                <p className="text-muted-foreground">
                  Take a clear photo of the front of your National ID card
                </p>
              </div>
              {renderUploadCard(
                'ID Card (Front)',
                'Make sure all details are clearly visible',
                <CreditCard className="h-8 w-8 text-primary" />,
                idFront,
                setIdFront,
                'id-front'
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold mb-2">Upload ID Back</h1>
                <p className="text-muted-foreground">
                  Take a clear photo of the back of your National ID card
                </p>
              </div>
              {renderUploadCard(
                'ID Card (Back)',
                'Make sure all details are clearly visible',
                <CreditCard className="h-8 w-8 text-primary" />,
                idBack,
                setIdBack,
                'id-back'
              )}
            </div>
          )}

          {currentStep === 3 && !requiresLicense && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold mb-2">Take a Selfie</h1>
                <p className="text-muted-foreground">
                  Take a clear photo of yourself holding your ID card
                </p>
              </div>
              {renderUploadCard(
                'Selfie with ID',
                'Hold your ID next to your face',
                <Camera className="h-8 w-8 text-primary" />,
                selfie,
                setSelfie,
                'selfie'
              )}
            </div>
          )}

          {currentStep === 3 && requiresLicense && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold mb-2">Take a Selfie</h1>
                <p className="text-muted-foreground">
                  Take a clear photo of yourself holding your ID card
                </p>
              </div>
              {renderUploadCard(
                'Selfie with ID',
                'Hold your ID next to your face',
                <Camera className="h-8 w-8 text-primary" />,
                selfie,
                setSelfie,
                'selfie'
              )}
            </div>
          )}

          {currentStep === 4 && requiresLicense && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold mb-2">Upload Driving License</h1>
                <p className="text-muted-foreground">
                  Upload a clear photo of your valid driving license
                </p>
              </div>
              <LicenseUploadStep
                userId={user?.id || ''}
                transportType={profile?.transport_type || null}
                licenseFile={drivingLicense}
                onLicenseChange={setDrivingLicense}
              />
            </div>
          )}
        </motion.div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(currentStep - 1)}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {!isLastStep ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmitVerification}
              disabled={!canProceed() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit for Verification
                  <CheckCircle2 className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyDocuments;
