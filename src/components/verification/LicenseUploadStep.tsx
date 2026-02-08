import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Upload, CheckCircle2, X, FileText } from 'lucide-react';

interface UploadedFile {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
}

interface LicenseUploadStepProps {
  userId: string;
  transportType: string | null;
  licenseFile: UploadedFile | null;
  onLicenseChange: (file: UploadedFile | null) => void;
}

export function LicenseUploadStep({
  userId,
  transportType,
  licenseFile,
  onLicenseChange,
}: LicenseUploadStepProps) {
  const requiresLicense = transportType === 'motorbike';

  const handleFileSelect = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, WebP image or PDF');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    const preview = file.type.startsWith('image/') 
      ? URL.createObjectURL(file) 
      : '';
    
    onLicenseChange({ file, preview, uploading: true, uploaded: false });

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/driving-license-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('id-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('id-documents')
        .getPublicUrl(fileName);

      onLicenseChange({
        file,
        preview,
        uploading: false,
        uploaded: true,
        url: urlData.publicUrl,
      });

      toast.success('Driving license uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload license');
      onLicenseChange(null);
    }
  }, [userId, onLicenseChange]);

  const removeFile = () => {
    onLicenseChange(null);
  };

  if (!requiresLicense) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-6 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
          <h3 className="font-semibold mb-2">No License Required</h3>
          <p className="text-sm text-muted-foreground">
            As a foot runner, you don't need to upload a driving license.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-dashed border-muted hover:border-primary/50 transition-colors">
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center">
          {licenseFile?.preview ? (
            <div className="relative w-full">
              <img
                src={licenseFile.preview}
                alt="Driving License"
                className="w-full h-48 object-cover rounded-lg"
              />
              {licenseFile.uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
              {licenseFile.uploaded && (
                <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              )}
              {!licenseFile.uploading && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 left-2"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : licenseFile?.file && !licenseFile.preview ? (
            // PDF file (no preview)
            <div className="relative w-full p-8 bg-muted rounded-lg">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">{licenseFile.file.name}</p>
              {licenseFile.uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
              {licenseFile.uploaded && (
                <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              )}
              {!licenseFile.uploading && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 left-2"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="p-4 bg-muted rounded-full mb-4">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Driving License</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a clear photo or scan of your valid driving license
              </p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload License
                  </span>
                </Button>
              </label>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
