import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OTPRequest {
  email: string;
  otp: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp }: OTPRequest = await req.json();

    if (!email || !otp) {
      throw new Error("Missing required fields: email and otp");
    }

    const emailResponse = await resend.emails.send({
      from: "City Errands Ke <Support@cityerrands.com>",
      to: [email],
      subject: "Your City Errands Ke Verification Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
              <div style="background: rgba(255,255,255,0.2); width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <span style="color: white; font-size: 24px; font-weight: bold;">CE</span>
              </div>
              <h1 style="color: white; margin: 0; font-size: 28px;">City Errands Ke</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">Email Verification</p>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #1e3a5f; margin: 0 0 20px 0; font-size: 22px;">Verify Your Email</h2>
              <p style="color: #666; line-height: 1.6; margin: 0 0 30px 0;">
                Thank you for registering with City Errands Ke. Please use the verification code below to complete your registration:
              </p>
              
              <div style="background: #f8fafc; border: 2px dashed #1e3a5f; border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
                <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">Your verification code is:</p>
                <div style="font-size: 36px; font-weight: bold; color: #1e3a5f; letter-spacing: 8px;">${otp}</div>
              </div>
              
              <p style="color: #999; font-size: 14px; margin: 0 0 20px 0;">
                This code will expire in 10 minutes. If you didn't request this verification, please ignore this email.
              </p>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
                <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
                  Need help? Contact us at <a href="mailto:support@cityerrands.com" style="color: #1e3a5f;">support@cityerrands.com</a>
                </p>
              </div>
            </div>
            
            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
              © 2026 City Errands Ke. Nairobi, Kenya
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("OTP email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
