import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Mail, Phone, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Activity, ShieldAlert, CheckCircle2, QrCode, RefreshCw, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export function TenantCommunicationCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useQuery<any>({
    queryKey: ["/api/me/tenant"],
  });

  // SMS Settings
  const [smsProvider, setSmsProvider] = useState("mock");
  const [smsAccountSid, setSmsAccountSid] = useState("");
  const [smsAuthToken, setSmsAuthToken] = useState("");
  const [smsSenderNumber, setSmsSenderNumber] = useState("");

  // Android SMS Gateway Settings
  const [androidSmsServerUrl, setAndroidSmsServerUrl] = useState("http://192.168.1.1:8080");
  const [androidSmsUsername, setAndroidSmsUsername] = useState("user");
  const [androidSmsPassword, setAndroidSmsPassword] = useState("");
  const [isCheckingAndroidStatus, setIsCheckingAndroidStatus] = useState(false);
  const [androidSmsStatus, setAndroidSmsStatus] = useState<{ online: boolean; deviceName?: string; simSlots?: number; message?: string } | null>(null);

  // WhatsApp Settings
  const [waProvider, setWaProvider] = useState("wppconnect");
  const [waAccountSid, setWaAccountSid] = useState("");
  const [waAuthToken, setWaAuthToken] = useState("");
  const [waSenderNumber, setWaSenderNumber] = useState("");
  const [waServerUrl, setWaServerUrl] = useState("http://localhost:21465");
  const [waSession, setWaSession] = useState("vaxplan");
  const [waSecretKey, setWaSecretKey] = useState("");
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [currentQrCode, setCurrentQrCode] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);

  // Live WPPConnect status query with smart polling & error immunity
  const { data: waStatus, refetch: refetchWaStatus, isFetching: isFetchingWaStatus } = useQuery<{
    connected: boolean;
    status: "CONNECTED" | "QRCODE" | "DISCONNECTED" | "OFFLINE" | "INITIALIZING" | "UNKNOWN";
    qrcode?: string | null;
    message?: string;
    phone?: string | null;
  }>({
    queryKey: ["/api/me/tenant/whatsapp/status", waServerUrl, waSession],
    queryFn: async () => {
      const url = `/api/me/tenant/whatsapp/status?serverUrl=${encodeURIComponent(waServerUrl)}&session=${encodeURIComponent(waSession)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        return { connected: false, status: "OFFLINE", message: `HTTP ${res.status}` };
      }
      return res.json();
    },
    enabled: waProvider === "wppconnect",
    refetchInterval: (query) => {
      if (!qrModalOpen) return false;
      const st = (query as any)?.state?.data?.status;
      if (st === "OFFLINE" || st === "CONNECTED") return false;
      return 3500;
    },
  });

  // Watch for QR code in status updates
  useEffect(() => {
    if (waStatus?.qrcode) {
      setCurrentQrCode(waStatus.qrcode);
      setPairingError(null);
    }
    if (waStatus?.connected && qrModalOpen) {
      setQrModalOpen(false);
      setPairingError(null);
      toast({
        title: "WhatsApp Connected! ✓",
        description: `Successfully linked with ${waStatus.phone || "your WhatsApp device"}.`,
      });
    }
  }, [waStatus, qrModalOpen]);

  // Email Settings
  const [emailHost, setEmailHost] = useState("");
  const [emailPort, setEmailPort] = useState("");
  const [emailUser, setEmailUser] = useState("");
  const [emailPass, setEmailPass] = useState("");
  const [emailFrom, setEmailFrom] = useState("");

  // Test states
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testSmsTo, setTestSmsTo] = useState("");
  const [testWaTo, setTestWaTo] = useState("");
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<{
    [channel: string]: { success: boolean; message: string; timestamp: Date };
  }>({});

  // Innovation: Smart Routing
  const [smartRouting, setSmartRouting] = useState(false);

  const { data: logs = [], refetch: refetchLogs } = useQuery<any[]>({
    queryKey: ["/api/me/tenant/communication-logs"],
  });

  useEffect(() => {
    if (tenant?.settings?.communication) {
      const comm = tenant.settings.communication;
      if (comm.sms) {
        setSmsProvider(comm.sms.provider || "mock");
        setSmsAccountSid(comm.sms.accountSid || "");
        setSmsAuthToken(comm.sms.authToken || "");
        setSmsSenderNumber(comm.sms.senderNumber || "");
      }
      if (comm.sms?.provider === "android_sms" || comm.androidSms) {
        const asCfg = comm.androidSms || {};
        setAndroidSmsServerUrl(asCfg.serverUrl || comm.sms?.serverUrl || "http://192.168.1.1:8080");
        setAndroidSmsUsername(asCfg.username || comm.sms?.username || "user");
        setAndroidSmsPassword(asCfg.password || comm.sms?.password || "");
      }
      if (comm.whatsapp) {
        setWaProvider(comm.whatsapp.provider || "wppconnect");
        setWaAccountSid(comm.whatsapp.accountSid || "");
        setWaAuthToken(comm.whatsapp.authToken || "");
        setWaSenderNumber(comm.whatsapp.senderNumber || "");
        setWaServerUrl(comm.whatsapp.serverUrl || "http://localhost:21465");
        setWaSession(comm.whatsapp.session || "vaxplan");
        setWaSecretKey(comm.whatsapp.secretKey || "");
      }
      if (comm.email) {
        setEmailHost(comm.email.host || "smtp.gmail.com");
        setEmailPort(String(comm.email.port || "465"));
        setEmailUser(comm.email.user || "");
        setEmailPass(comm.email.pass || "");
        setEmailFrom(comm.email.from || "");
      } else {
        setEmailHost("smtp.gmail.com");
        setEmailPort("465");
      }
      setSmartRouting(comm.smartRouting === true);
    } else {
      setEmailHost("smtp.gmail.com");
      setEmailPort("465");
    }
  }, [tenant]);

  const mutation = useMutation({
    mutationFn: async (updatedSettings: any) =>
      apiRequest("PATCH", "/api/me/tenant", { settings: updatedSettings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/tenant"] });
      toast({
        title: "Communication Settings Saved",
        description: "Outgoing notifications will now use these credentials.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to save settings",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const onSave = () => {
    const existingSettings = tenant?.settings || {};
    const updatedSettings = {
      ...existingSettings,
      communication: {
        ...existingSettings.communication,
        sms: {
          provider: smsProvider,
          accountSid: smsAccountSid.trim(),
          authToken: smsAuthToken.trim(),
          senderNumber: smsSenderNumber.trim(),
          // Android SMS Gateway fields (used when provider === "android_sms")
          serverUrl: androidSmsServerUrl.trim() || "http://192.168.1.1:8080",
          username: androidSmsUsername.trim() || "user",
          password: androidSmsPassword.trim(),
        },
        whatsapp: {
          provider: waProvider,
          accountSid: waAccountSid.trim(),
          authToken: waAuthToken.trim(),
          senderNumber: waSenderNumber.trim(),
          serverUrl: waServerUrl.trim() || "http://localhost:21465",
          session: waSession.trim() || "vaxplan",
          secretKey: waSecretKey.trim(),
        },
        email: {
          host: emailHost.trim() || "smtp.gmail.com",
          port: emailPort ? Number(emailPort) : 465,
          user: emailUser.trim(),
          pass: emailPass.trim(),
          from: emailFrom.trim(),
        },
        smartRouting,
      },
    };
    mutation.mutate(updatedSettings);
  };

  const handleTest = async (channel: 'email' | 'sms' | 'whatsapp') => {
    let destination = "";
    if (channel === 'email') destination = testEmailTo;
    if (channel === 'sms') destination = testSmsTo;
    if (channel === 'whatsapp') destination = testWaTo;

    if (!destination) {
      toast({ title: "Destination Required", description: "Please enter a test destination.", variant: "destructive" });
      return;
    }

    const config = channel === "email"
      ? {
          host: emailHost.trim() || "smtp.gmail.com",
          port: emailPort ? Number(emailPort) : 465,
          user: emailUser.trim(),
          pass: emailPass.trim(),
          from: emailFrom.trim(),
        }
      : channel === "sms"
        ? {
            provider: smsProvider,
            accountSid: smsAccountSid.trim(),
            authToken: smsAuthToken.trim(),
            senderNumber: smsSenderNumber.trim(),
          }
        : {
            provider: waProvider,
            accountSid: waAccountSid.trim(),
            authToken: waAuthToken.trim(),
            senderNumber: waSenderNumber.trim(),
            serverUrl: waServerUrl.trim() || "http://localhost:21465",
            session: waSession.trim() || "vaxplan",
            secretKey: waSecretKey.trim(),
          };

    setTestingChannel(channel);
    try {
      const data: any = await apiRequest("POST", "/api/me/tenant/test-communication", {
        channel,
        destination: destination.trim(),
        config,
      });
      const msg = data.message || "Message successfully sent to gateway.";
      setTestFeedback(prev => ({
        ...prev,
        [channel]: { success: true, message: msg, timestamp: new Date() }
      }));
      toast({
        title: "Test Message Dispatched",
        description: msg,
      });
    } catch (err: any) {
      const errMsg = err.message || "Failed to dispatch test message";
      setTestFeedback(prev => ({
        ...prev,
        [channel]: { success: false, message: errMsg, timestamp: new Date() }
      }));
      toast({
        title: "Test Failed",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setTestingChannel(null);
      refetchLogs();
    }
  };

  const handleStartPairing = async () => {
    setIsStartingSession(true);
    setPairingError(null);
    setCurrentQrCode(null);
    try {
      const res: any = await apiRequest("POST", "/api/me/tenant/whatsapp/start-session", {
        serverUrl: waServerUrl.trim() || "http://localhost:21465",
        session: waSession.trim() || "vaxplan",
        secretKey: waSecretKey.trim(),
      });
      if (res.status === "OFFLINE" || (!res.connected && !res.qrcode && res.status !== "QRCODE")) {
        setPairingError(res.message || `Unable to reach WPPConnect server at ${waServerUrl.trim() || "http://localhost:21465"}.`);
      } else if (res.qrcode) {
        setCurrentQrCode(res.qrcode);
      }
      setQrModalOpen(true);
      refetchWaStatus();
    } catch (err: any) {
      setPairingError(err.message || `Failed to start WhatsApp pairing session.`);
      setQrModalOpen(true);
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleCloseSession = async () => {
    try {
      await apiRequest("POST", "/api/me/tenant/whatsapp/close-session", {});
      toast({
        title: "Session Disconnected",
        description: "WhatsApp session was disconnected. You can now pair a new device.",
      });
      refetchWaStatus();
    } catch (err: any) {
      toast({
        title: "Disconnect Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleCheckAndroidStatus = async () => {
    setIsCheckingAndroidStatus(true);
    setAndroidSmsStatus(null);
    try {
      const url = `/api/me/tenant/sms/android/status?serverUrl=${encodeURIComponent(androidSmsServerUrl.trim() || "http://192.168.1.1:8080")}&username=${encodeURIComponent(androidSmsUsername.trim() || "user")}&password=${encodeURIComponent(androidSmsPassword.trim())}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data: any = await res.json();
      setAndroidSmsStatus(data);
    } catch (err: any) {
      setAndroidSmsStatus({ online: false, message: err.message });
    } finally {
      setIsCheckingAndroidStatus(false);
    }
  };

  return (
    <>
    <Card data-testid="card-tenant-communication">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Communication Integrations</CardTitle>
            <CardDescription>
              Configure providers for SMS, WhatsApp, and Email dispatch.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Smart Routing Callout */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-4 rounded-xl flex items-start gap-4">
          <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-1" />
          <div className="flex-1 space-y-1">
            <h4 className="font-semibold text-sm text-indigo-900 dark:text-indigo-300">Intelligent Omnichannel Routing</h4>
            <p className="text-xs text-indigo-800/80 dark:text-indigo-400/80">
              When enabled, the Unified Communication Engine will automatically failover from WhatsApp &rarr; SMS &rarr; Email if a provider fails or the recipient isn't registered on the channel.
            </p>
          </div>
          <Switch checked={smartRouting} onCheckedChange={setSmartRouting} disabled={isLoading} />
        </div>
        
        {/* Email Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Mail className="w-4 h-4" /> Email (SMTP)</h3>
            <span className="text-[11px] text-muted-foreground">Supports Gmail, Office365, or Custom SMTP</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">SMTP Host</Label>
              <Input placeholder="smtp.gmail.com" value={emailHost} onChange={e => setEmailHost(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">SMTP Port</Label>
              <Input placeholder="465" value={emailPort} onChange={e => setEmailPort(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">SMTP User (Email)</Label>
              <Input placeholder="user@example.com" value={emailUser} onChange={e => setEmailUser(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">SMTP Password / App Password</Label>
              <Input type="password" placeholder="••••••••" value={emailPass} onChange={e => setEmailPass(e.target.value)} disabled={isLoading} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label className="text-xs">From Header</Label>
              <Input placeholder="&quot;VaxPlan Notifications&quot; <no-reply@example.com>" value={emailFrom} onChange={e => setEmailFrom(e.target.value)} disabled={isLoading} />
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-300 space-y-1">
            <p className="font-medium flex items-center gap-1.5">
              <span>💡</span> Gmail Setup Guide:
            </p>
            <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-amber-800/90 dark:text-amber-400/90 pl-1">
              <li>Turn <strong>2-Step Verification ON</strong> in your Google Account (<a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="underline font-medium">myaccount.google.com/security</a>).</li>
              <li>Generate an App Password at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline font-medium">myaccount.google.com/apppasswords</a> (App name: <em>VaxPlan</em>).</li>
              <li>Paste the generated 16-character code directly into <strong>SMTP Password</strong>.</li>
            </ol>
          </div>
          
          <div className="flex items-end gap-2 mt-2 bg-muted/30 p-3 rounded-lg border border-border/50">
            <div className="space-y-1.5 flex-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Test Destination</Label>
              <Input placeholder="Enter test email address" value={testEmailTo} onChange={e => setTestEmailTo(e.target.value)} disabled={isLoading || testingChannel !== null} />
            </div>
            <Button type="button" variant="secondary" onClick={() => handleTest('email')} disabled={isLoading || testingChannel !== null}>
              {testingChannel === 'email' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send Test
            </Button>
          </div>

          {testFeedback['email'] && (
            <div className={`p-3 rounded-lg border text-xs whitespace-pre-wrap ${
              testFeedback['email'].success
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}>
              <div className="flex items-center gap-2 font-semibold mb-1">
                {testFeedback['email'].success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
                <span>{testFeedback['email'].success ? 'Gateway Verified Successfully' : 'Gateway Verification Failed'}</span>
              </div>
              <p className="leading-relaxed">{testFeedback['email'].message}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* SMS Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Phone className="w-4 h-4" /> SMS Provider</h3>
          <div className="space-y-2">
            <Label className="text-xs">Provider</Label>
            <Select value={smsProvider} onValueChange={setSmsProvider} disabled={isLoading}>
              <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mock">Mock / Console Logs</SelectItem>
                <SelectItem value="redis">Redis Pub/Sub (External Worker)</SelectItem>
                <SelectItem value="twilio">Twilio</SelectItem>
                <SelectItem value="africastalking">Africa's Talking</SelectItem>
                <SelectItem value="android_sms">Android SMS Gateway (Open-Source, Self-Hosted / $0)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {smsProvider === "android_sms" && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Android Device URL</Label>
                  <Input
                    placeholder="http://192.168.1.1:8080"
                    value={androidSmsServerUrl}
                    onChange={(e) => setAndroidSmsServerUrl(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-[10px] text-muted-foreground">Local URL shown in the SMS Gateway app</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Username</Label>
                  <Input
                    placeholder="user"
                    value={androidSmsUsername}
                    onChange={(e) => setAndroidSmsUsername(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-[10px] text-muted-foreground">Default is &quot;user&quot;</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Password</Label>
                  <Input
                    type="password"
                    placeholder="App password"
                    value={androidSmsPassword}
                    onChange={(e) => setAndroidSmsPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-[10px] text-muted-foreground">Set in the app settings</p>
                </div>
              </div>

              {/* Live Device Status Bar */}
              <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">Device Status:</span>
                    {androidSmsStatus?.online ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-0 flex items-center gap-1 font-semibold text-xs">
                        <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse inline-block" />
                        Online {androidSmsStatus.deviceName ? `(${androidSmsStatus.deviceName})` : ""}
                        {androidSmsStatus.simSlots ? ` · ${androidSmsStatus.simSlots} SIM` : ""}
                      </Badge>
                    ) : androidSmsStatus && !androidSmsStatus.online ? (
                      <Badge variant="destructive" className="flex items-center gap-1 font-semibold text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Unreachable
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Not Checked</Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2.5"
                    onClick={handleCheckAndroidStatus}
                    disabled={isCheckingAndroidStatus}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isCheckingAndroidStatus ? "animate-spin" : ""}`} />
                    Check Device
                  </Button>
                </div>

                {androidSmsStatus?.message && (
                  <p className={`text-[11px] leading-relaxed ${androidSmsStatus.online ? "text-muted-foreground" : "text-rose-600 dark:text-rose-400 font-medium"}`}>
                    {androidSmsStatus.message}
                  </p>
                )}

                {androidSmsStatus && !androidSmsStatus.online && (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 text-[11px] text-amber-900 dark:text-amber-300 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      Android SMS Gateway Setup:
                    </p>
                    <ol className="list-decimal list-inside space-y-0.5 pl-1 text-[10.5px]">
                      <li>Install <strong>SMS Gateway for Android</strong> from <a href="https://sms-gate.app" target="_blank" rel="noopener noreferrer" className="underline font-medium">sms-gate.app</a>.</li>
                      <li>Open the app → tap <strong>Local Server</strong> → enable it.</li>
                      <li>Note the IP address and port shown (e.g. <code>http://192.168.1.x:8080</code>).</li>
                      <li>Ensure your VPS/device is on the same local network, or use a tunnel.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}

          {smsProvider !== "mock" && smsProvider !== "android_sms" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Account SID / API Key</Label>
                <Input value={smsAccountSid} onChange={e => setSmsAccountSid(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Auth Token / Username</Label>
                <Input type="password" value={smsAuthToken} onChange={e => setSmsAuthToken(e.target.value)} disabled={isLoading} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-xs">Sender Number / ID</Label>
                <Input placeholder="+1234567890" value={smsSenderNumber} onChange={e => setSmsSenderNumber(e.target.value)} disabled={isLoading} />
              </div>
            </div>
          )}
          
          <div className="flex items-end gap-2 mt-2 bg-muted/30 p-3 rounded-lg border border-border/50">
            <div className="space-y-1.5 flex-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Test Destination</Label>
              <Input placeholder="Enter test phone number (e.g. +260...)" value={testSmsTo} onChange={e => setTestSmsTo(e.target.value)} disabled={isLoading || testingChannel !== null} />
            </div>
            <Button type="button" variant="secondary" onClick={() => handleTest('sms')} disabled={isLoading || testingChannel !== null}>
              {testingChannel === 'sms' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send Test
            </Button>
          </div>

          {testFeedback['sms'] && (
            <div className={`p-3 rounded-lg border text-xs whitespace-pre-wrap ${
              testFeedback['sms'].success
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}>
              <div className="flex items-center gap-2 font-semibold mb-1">
                {testFeedback['sms'].success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
                <span>{testFeedback['sms'].success ? 'SMS Gateway Verified' : 'SMS Gateway Failed'}</span>
              </div>
              <p className="leading-relaxed">{testFeedback['sms'].message}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* WhatsApp Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp Gateway
            </h3>
            {waProvider === "wppconnect" && (
              <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
                100% Free & Open-Source
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Provider</Label>
            <Select value={waProvider} onValueChange={setWaProvider} disabled={isLoading}>
              <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wppconnect">WPPConnect Server (Open-Source, Self-Hosted / $0)</SelectItem>
                <SelectItem value="mock">Mock / Console Logs</SelectItem>
                <SelectItem value="redis">Redis Pub/Sub (External Worker)</SelectItem>
                <SelectItem value="twilio">Twilio WhatsApp (Paid SaaS)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {waProvider === "wppconnect" && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">WPPConnect Server URL</Label>
                  <Input
                    placeholder="http://localhost:21465"
                    value={waServerUrl}
                    onChange={(e) => setWaServerUrl(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-[10px] text-muted-foreground">Internal URL on your VPS or local machine</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Session Identifier</Label>
                  <Input
                    placeholder="vaxplan"
                    value={waSession}
                    onChange={(e) => setWaSession(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-[10px] text-muted-foreground">Default session namespace</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Secret Key / Token (Optional)</Label>
                  <Input
                    type="password"
                    placeholder="Optional bearer token"
                    value={waSecretKey}
                    onChange={(e) => setWaSecretKey(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-[10px] text-muted-foreground">If configured in WPPConnect</p>
                </div>
              </div>

              {/* Live Gateway Status & Pairing Bar */}
              <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">Gateway Status:</span>
                    {waStatus?.connected ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-0 flex items-center gap-1 font-semibold text-xs">
                        <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse inline-block" />
                        Connected {waStatus.phone ? `(${waStatus.phone})` : ""}
                      </Badge>
                    ) : waStatus?.status === "QRCODE" ? (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-0 flex items-center gap-1 font-semibold text-xs">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping inline-block" />
                        Pairing Required
                      </Badge>
                    ) : waStatus?.status === "OFFLINE" ? (
                      <Badge variant="destructive" className="flex items-center gap-1 font-semibold text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Server Offline / Unreachable
                      </Badge>
                    ) : isFetchingWaStatus && !waStatus ? (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Checking...
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {waStatus?.status || "Disconnected"}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2.5"
                      onClick={() => refetchWaStatus()}
                      disabled={isFetchingWaStatus}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetchingWaStatus ? "animate-spin" : ""}`} />
                      Check Status
                    </Button>

                    {waStatus?.connected ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs px-2.5"
                        onClick={handleCloseSession}
                      >
                        Disconnect Device
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        onClick={handleStartPairing}
                        disabled={isStartingSession}
                      >
                        {isStartingSession ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <QrCode className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Pair Device (Scan QR)
                      </Button>
                    )}
                  </div>
                </div>

                {waStatus?.message && waStatus.status !== "CONNECTED" && (
                  <p className={`text-[11px] leading-relaxed ${waStatus.status === "OFFLINE" ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted-foreground"}`}>
                    {waStatus.message}
                  </p>
                )}

                {waStatus?.status === "OFFLINE" && (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 text-[11px] text-amber-900 dark:text-amber-300 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      To run WPPConnect locally or on your Hostinger VPS:
                    </p>
                    <code className="block p-1.5 bg-black/5 dark:bg-white/5 rounded font-mono text-[10px] select-all">
                      docker run -d --name wppconnect --restart unless-stopped -p 21465:21465 -v wppconnect_tokens:/usr/src/wpp-server/tokens -v wppconnect_user_data:/usr/src/wpp-server/userDataDir wppconnect/wppconnect-server:latest
                    </code>
                  </div>
                )}
              </div>
            </div>
          )}

          {waProvider === "twilio" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Account SID</Label>
                <Input value={waAccountSid} onChange={e => setWaAccountSid(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Auth Token</Label>
                <Input type="password" value={waAuthToken} onChange={e => setWaAuthToken(e.target.value)} disabled={isLoading} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-xs">Sender Number (without whatsapp: prefix)</Label>
                <Input placeholder="+1234567890" value={waSenderNumber} onChange={e => setWaSenderNumber(e.target.value)} disabled={isLoading} />
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 mt-2 bg-muted/30 p-3 rounded-lg border border-border/50">
            <div className="space-y-1.5 flex-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Test Destination</Label>
              <Input placeholder="Enter test WhatsApp number (e.g. +260...)" value={testWaTo} onChange={e => setTestWaTo(e.target.value)} disabled={isLoading || testingChannel !== null} />
            </div>
            <Button type="button" variant="secondary" onClick={() => handleTest('whatsapp')} disabled={isLoading || testingChannel !== null}>
              {testingChannel === 'whatsapp' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send Test
            </Button>
          </div>

          {testFeedback['whatsapp'] && (
            <div className={`p-3 rounded-lg border text-xs whitespace-pre-wrap ${
              testFeedback['whatsapp'].success
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}>
              <div className="flex items-center gap-2 font-semibold mb-1">
                {testFeedback['whatsapp'].success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
                <span>{testFeedback['whatsapp'].success ? 'WhatsApp Gateway Verified' : 'WhatsApp Gateway Failed'}</span>
              </div>
              <p className="leading-relaxed">{testFeedback['whatsapp'].message}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onSave} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Integrations"}
          </Button>
        </div>

        <Separator className="my-6" />

        {/* Dispatch History Logs */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4" /> Recent Dispatches
          </h3>
          <div className="rounded-md border max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead className="w-[140px]">Time</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                      No communications dispatched yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.createdAt), "PP HH:mm")}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize text-xs font-medium px-2 py-0.5 rounded-full bg-secondary/50">
                          {log.channel}
                        </span>
                        {log.fallbackTriggered && (
                          <span className="ml-2 text-[10px] text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">Fallback</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-xs">{log.destination}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {log.status === 'delivered' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                          )}
                          <span className="text-xs capitalize">{log.status}</span>
                        </div>
                        {log.status === 'failed' && log.providerResponse && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px] truncate" title={log.providerResponse}>
                            {log.providerResponse}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* ── WPPConnect WhatsApp QR Code Pairing Modal ── */}
    <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
      <DialogContent className="max-w-md p-6 text-center space-y-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-bold flex items-center justify-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-600" />
            Scan QR Code with WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs">
            Link your phone to enable 100% free automated WhatsApp notifications.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border flex flex-col items-center justify-center min-h-[260px] shadow-inner">
          {currentQrCode ? (
            <img
              src={currentQrCode.startsWith("data:") ? currentQrCode : `data:image/png;base64,${currentQrCode}`}
              alt="WhatsApp QR Code"
              className="w-56 h-56 object-contain rounded-lg shadow-xs"
            />
          ) : pairingError || waStatus?.status === "OFFLINE" ? (
            <div className="space-y-3 flex flex-col items-center text-center p-2 max-w-sm">
              <div className="h-11 w-11 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Cannot Reach WPPConnect Gateway</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {pairingError || waStatus?.message || `Unable to reach ${waServerUrl}.`}
                </p>
              </div>
              <div className="text-[11px] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 p-2.5 rounded-lg text-left space-y-1">
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  Testing on Localhost?
                </p>
                <p className="leading-normal text-[10.5px]">
                  You are opening VaxPlan at <code>localhost:5000</code>. WPPConnect Docker is running on your <strong>Ubuntu VPS</strong>.
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-[10.5px]">
                  <li>Open VaxPlan on your <strong>VPS domain/IP</strong> where WPPConnect is hosted locally.</li>
                  <li>Or if testing locally on Windows, start WPPConnect on this PC with Docker Desktop.</li>
                </ul>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleStartPairing()}>
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Retry Connection
              </Button>
            </div>
          ) : (
            <div className="space-y-2 flex flex-col items-center">
              <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
              <p className="text-xs text-muted-foreground">Connecting to WPPConnect server...</p>
            </div>
          )}
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground text-left bg-muted/40 p-3 rounded-lg border">
          <p className="font-semibold text-foreground">How to pair:</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Open WhatsApp on your mobile phone</li>
            <li>Tap <strong>Settings</strong> (iOS) or <strong>Menu ⋮</strong> (Android) &gt; <strong>Linked Devices</strong></li>
            <li>Tap <strong>Link a Device</strong> and point your camera at this QR code</li>
          </ol>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Waiting for scan...
          </span>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => handleStartPairing()}
            disabled={isStartingSession}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isStartingSession ? "animate-spin" : ""}`} />
            Refresh QR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
