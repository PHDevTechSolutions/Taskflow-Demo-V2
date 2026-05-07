"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { CheckCircle2Icon, ArrowLeft, ArrowRight, Settings, Lock, Save, RotateCcw, Eye, EyeOff, Calendar, Clock, Bell, Palette, Shield, FileText, CheckSquare, Filter, X, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";

import { FieldGroup, FieldSet, FieldLabel, Field, FieldContent, FieldDescription, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

// Static data - defined outside component to prevent re-creation on every render
const STEP2_SOURCES = [
    {
        value: "Outbound - Touchbase",
        title: "Outbound - Touchbase",
        desc: "Initial call to reconnect or update the client.",
    },
    {
        value: "Outbound - Follow-up",
        title: "Outbound - Follow-up",
        desc: "Follow-up call for progress or requirements.",
    },
];

const STEP3_CALL_STATUS = [
    {
        value: "Successful",
        title: "Successful",
        desc: "Client was reached and conversation was completed.",
    },
    {
        value: "Unsuccessful",
        title: "Unsuccessful",
        desc: "Client was not reached or call was not completed.",
    },
];

const STEP4_SUCCESSFUL_TYPES = [
    {
        value: "No Requirements",
        title: "No Requirements",
        desc: "Client states no requirements at the moment.",
    },
    {
        value: "Waiting for Future Projects",
        title: "Waiting for Future Projects",
        desc: "Client may have upcoming projects but no current requirements.",
    },
    {
        value: "With RFQ",
        title: "With RFQ",
        desc: "Client has a Request for Quotation.",
    },
    {
        value: "For Sched",
        title: "For Sched",
        desc: "Schedule a follow-up meeting or call with the client.",
    },
    {
        value: "Not Connected With The Company",
        title: "Not Connected With The Company",
        desc: "Client confirmed they are no longer associated with the company.",
    },
];

const STEP4_UNSUCCESSFUL_TYPES = [
    {
        value: "Ringing Only",
        title: "Ringing Only",
        desc: "Phone rang but no one answered the call.",
    },
    {
        value: "Cannot Be Reached",
        title: "Cannot Be Reached",
        desc: "Client is unreachable or phone is unattended.",
    },
];

interface OutboundSheetProps {
    step: number;
    setStep: React.Dispatch<React.SetStateAction<number>>;
    source: string;
    setSource: React.Dispatch<React.SetStateAction<string>>;
    callStatus: string;
    setCallStatus: React.Dispatch<React.SetStateAction<string>>;
    callType: string;
    setCallType: React.Dispatch<React.SetStateAction<string>>;
    followUpDate: string;
    setFollowUpDate: React.Dispatch<React.SetStateAction<string>>;
    status: string;
    setStatus: React.Dispatch<React.SetStateAction<string>>;
    remarks: string;
    setRemarks: React.Dispatch<React.SetStateAction<string>>;
    typeClient: string;
    setTypeClient: React.Dispatch<React.SetStateAction<string>>;
    loading: boolean;

    contact_number: string;
    setContactNumber: React.Dispatch<React.SetStateAction<string>>;
    handleBack: () => void;
    handleNext: () => void;
    handleSave: () => void;
}

export function OutboundSheet(props: OutboundSheetProps) {
    const {
        step,
        source,
        callStatus,
        callType,
        followUpDate,
        status,
        remarks,
        typeClient,
        // handlers
        handleNext,
    } = props;

    // Removed useEffect that depended on callback

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMessage, setDialogMessage] = useState("");
    
    // Settings dialog states
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [passwordError, setPasswordError] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [settingsUnlocked, setSettingsUnlocked] = useState(false);
    const [activeSettingsTab, setActiveSettingsTab] = useState("general");
    
    // Settings configuration state
    const [settings, setSettings] = useState({
        // General Settings
        autoSave: true,
        confirmBeforeSave: true,
        showStepIndicator: true,
        enableKeyboardShortcuts: true,
        
        // Date & Time Settings
        skipSundays: true,
        skipHolidays: false,
        customWeekendDays: [0], // 0 = Sunday
        dateFormat: "YYYY-MM-DD",
        timeZone: "Asia/Manila",
        
        // Follow-up Days (per call type)
        followUpDays: {
            "Ringing Only": 7,
            "No Requirements": 15,
            "Cannot Be Reached": 30,
            "Waiting for Future Projects": 30,
            "With RFQ": 0,
        },
        
        // Call Type Visibility
        enabledCallTypes: {
            successful: {
                "No Requirements": true,
                "Waiting for Future Projects": true,
                "With RFQ": true,
                "For Sched": true,
                "Not Connected With The Company": true,
            },
            unsuccessful: {
                "Ringing Only": true,
                "Cannot Be Reached": true,
            },
        },
        
        // Status Mapping
        statusMapping: {
            "No Requirements": "Completed",
            "Waiting for Future Projects": "Completed",
            "With RFQ": "Assisted",
            "For Sched": "Assisted",
            "Not Connected With The Company": "Approval for TSM",
            "Cannot Be Reached": "Approval for TSM",
        },
        
        // Validation Settings
        requireRemarks: true,
        requireFollowUpDate: true,
        minRemarksLength: 5,
        blockBackdatedFollowUp: true,
        
        // UI Preferences
        theme: "default",
        accentColor: "cyan",
        compactMode: false,
        showDescriptions: true,
        animationEnabled: true,
        
        // Notification Settings
        enableNotifications: true,
        soundOnSave: false,
        showSuccessToast: true,
        
        // Remarks Templates
        remarksTemplates: [
            "Client has no immediate requirements.",
            "Follow up needed for next quarter.",
            "Waiting for budget approval.",
            "Client requested quotation.",
            "Schedule meeting for discussion.",
            "Client not available, will call again.",
            "Wrong contact number.",
        ],
        
        // Security Settings
        requirePasswordForSettings: true,
        settingsPassword: "PHDEVTECH",
        autoLockSettings: true,
        lockTimeoutMinutes: 5,
    });
    
    // Load settings from localStorage on mount
    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem("outboundSheetSettings");
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                setSettings(prev => ({ ...prev, ...parsed }));
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
        }
    }, []);
    
    // Save settings to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem("outboundSheetSettings", JSON.stringify(settings));
        } catch (error) {
            console.error("Failed to save settings:", error);
        }
    }, [settings]);
    
    // Password verification handler
    const verifyPassword = useCallback(() => {
        if (passwordInput === settings.settingsPassword) {
            setPasswordError(false);
            setPasswordDialogOpen(false);
            setSettingsUnlocked(true);
            setPasswordInput("");
            setSettingsOpen(true);
        } else {
            setPasswordError(true);
        }
    }, [passwordInput, settings.settingsPassword]);
    
    // Handle settings button click
    const handleSettingsClick = useCallback(() => {
        if (settings.requirePasswordForSettings && !settingsUnlocked) {
            setPasswordDialogOpen(true);
        } else {
            setSettingsOpen(true);
        }
    }, [settings.requirePasswordForSettings, settingsUnlocked]);
    
    // Lock settings handler
    const lockSettings = useCallback(() => {
        setSettingsUnlocked(false);
        setSettingsOpen(false);
        setActiveSettingsTab("general");
    }, []);
    
    // Reset settings to default
    const resetSettings = useCallback(() => {
        setSettings({
            autoSave: true,
            confirmBeforeSave: true,
            showStepIndicator: true,
            enableKeyboardShortcuts: true,
            skipSundays: true,
            skipHolidays: false,
            customWeekendDays: [0],
            dateFormat: "YYYY-MM-DD",
            timeZone: "Asia/Manila",
            followUpDays: {
                "Ringing Only": 7,
                "No Requirements": 15,
                "Cannot Be Reached": 30,
                "Waiting for Future Projects": 30,
                "With RFQ": 0,
            },
            enabledCallTypes: {
                successful: {
                    "No Requirements": true,
                    "Waiting for Future Projects": true,
                    "With RFQ": true,
                    "For Sched": true,
                    "Not Connected With The Company": true,
                },
                unsuccessful: {
                    "Ringing Only": true,
                    "Cannot Be Reached": true,
                },
            },
            statusMapping: {
                "No Requirements": "Completed",
                "Waiting for Future Projects": "Completed",
                "With RFQ": "Assisted",
                "For Sched": "Assisted",
                "Not Connected With The Company": "Approval for TSM",
                "Cannot Be Reached": "Approval for TSM",
            },
            requireRemarks: true,
            requireFollowUpDate: true,
            minRemarksLength: 5,
            blockBackdatedFollowUp: true,
            theme: "default",
            accentColor: "cyan",
            compactMode: false,
            showDescriptions: true,
            animationEnabled: true,
            enableNotifications: true,
            soundOnSave: false,
            showSuccessToast: true,
            remarksTemplates: [
                "Client has no immediate requirements.",
                "Follow up needed for next quarter.",
                "Waiting for budget approval.",
                "Client requested quotation.",
                "Schedule meeting for discussion.",
                "Client not available, will call again.",
                "Wrong contact number.",
            ],
            requirePasswordForSettings: true,
            settingsPassword: "PHDEVTECH",
            autoLockSettings: true,
            lockTimeoutMinutes: 5,
        });
    }, []);
    
    // Update individual setting
    const updateSetting = useCallback(<K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    }, []);
    
    // Update nested setting
    const updateFollowUpDays = useCallback((callType: keyof typeof settings.followUpDays, days: number) => {
        setSettings(prev => ({
            ...prev,
            followUpDays: { ...prev.followUpDays, [callType]: days }
        }));
    }, []);
    
    // Update call type visibility
    const toggleCallType = useCallback((status: "successful" | "unsuccessful", callType: string, enabled: boolean) => {
        setSettings(prev => ({
            ...prev,
            enabledCallTypes: {
                ...prev.enabledCallTypes,
                [status]: {
                    ...prev.enabledCallTypes[status],
                    [callType]: enabled
                }
            }
        }));
    }, []);
    
    // Update status mapping
    const updateStatusMapping = useCallback((callType: keyof typeof settings.statusMapping, status: string) => {
        setSettings(prev => ({
            ...prev,
            statusMapping: { ...prev.statusMapping, [callType]: status }
        }));
    }, []);
    
    // Memoize today's date for min date in For Sched picker
    const todayString = useMemo(() => new Date().toISOString().split("T")[0], []);

    // Helper function to skip Sundays - memoized
    const skipSunday = useCallback((date: Date): Date => {
        const result = new Date(date);
        while (result.getDay() === 0) { // 0 = Sunday
            result.setDate(result.getDate() + 1);
        }
        return result;
    }, []);

    // Calculate follow-up date based on call type
    useEffect(() => {
        if (!callType) {
            props.setFollowUpDate("");
            return;
        }

        // Skip if call type doesn't need auto-calculated date
        if (callType === "Not Connected With The Company" || callType === "For Sched") {
            return;
        }

        const today = new Date();
        let daysToAdd = 0;

        switch (callType) {
            case "Ringing Only":
                daysToAdd = 7;
                break;
            case "No Requirements":
                daysToAdd = 15;
                break;
            case "Cannot Be Reached":
                daysToAdd = 30;
                break;
            case "Waiting for Future Projects":
                daysToAdd = 30;
                break;
            case "With RFQ":
                daysToAdd = 0;
                break;
            default:
                return;
        }

        const newDate = new Date(today);
        newDate.setDate(today.getDate() + daysToAdd);

        // Skip Sundays
        const finalDate = skipSunday(newDate);
        const formattedDate = finalDate.toISOString().split("T")[0];

        // Only update if different to prevent loops
        if (formattedDate !== followUpDate) {
            props.setFollowUpDate(formattedDate);
        }
    }, [callType, skipSunday]); // Removed followUpDate to prevent loops

    // Auto-set status based on call type - only when callType changes
    useEffect(() => {
        if (!callType) return;

        const statusMap: Record<string, string> = {
            "No Requirements": "Completed",
            "Waiting for Future Projects": "Completed",
            "With RFQ": "Assisted",
            "For Sched": "Assisted",
            "Not Connected With The Company": "Approval for TSM",
            "Cannot Be Reached": "Approval for TSM",
        };

        const newStatus = statusMap[callType];
        if (newStatus && newStatus !== status) {
            props.setStatus(newStatus);
        }
    }, [callType]); // Only depend on callType

    // Validation function - useCallback to prevent recreating on every render
    const validateStep = useCallback(() => {
        switch (step) {
            case 2:
                if (!source) {
                    setDialogMessage("Please select a Source.");
                    setDialogOpen(true);
                    return false;
                }
                return true;
            case 3:
                if (!callStatus) {
                    setDialogMessage("Please select Call Status.");
                    setDialogOpen(true);
                    return false;
                }
                return true;
            case 4:
                if (!callType) {
                    setDialogMessage("Please select Call Type.");
                    setDialogOpen(true);
                    return false;
                }
                // followUpDate only required for Successful calls (except Not Connected and For Sched)
                if (settings.requireFollowUpDate && callStatus === "Successful" && !followUpDate && callType !== "Not Connected With The Company" && callType !== "For Sched") {
                    setDialogMessage("Please enter Follow Up Date.");
                    setDialogOpen(true);
                    return false;
                }
                // followUpDate required for Cannot Be Reached (auto-calculated 30 days)
                if (settings.requireFollowUpDate && callType === "Cannot Be Reached" && !followUpDate) {
                    setDialogMessage("Follow Up Date is required for Cannot Be Reached.");
                    setDialogOpen(true);
                    return false;
                }
                return true;
            case 5:
                if (settings.requireRemarks && !remarks.trim()) {
                    setDialogMessage("Please enter Remarks.");
                    setDialogOpen(true);
                    return false;
                }
                if (settings.requireRemarks && remarks.trim().length < settings.minRemarksLength) {
                    setDialogMessage(`Remarks must be at least ${settings.minRemarksLength} characters.`);
                    setDialogOpen(true);
                    return false;
                }
                if (!status) {
                    setDialogMessage("Please select Status.");
                    setDialogOpen(true);
                    return false;
                }
                return true;
            default:
                return true;
        }
    }, [step, source, callStatus, callType, followUpDate, remarks, status, settings]);

    const onSaveClick = useCallback(() => {
        if (validateStep()) {
            props.handleSave();
        }
    }, [validateStep, props.handleSave]);

    const onNextClick = useCallback(() => {
        if (validateStep()) {
            handleNext();
        }
    }, [validateStep, handleNext]);

    // Memoize status options for Step 5
    const statusOptions = useMemo(() => {
        const options: Array<{value: string; title: string; desc: string}> = [];
        
        // For No Requirements and Waiting for Future Projects → Completed
        if (callType === "No Requirements" || callType === "Waiting for Future Projects") {
            options.push({
                value: "Completed",
                title: "Completed",
                desc: "Call was completed — client has no immediate requirements.",
            });
        }
        
        // For With RFQ and For Sched → Assisted
        if (callType === "With RFQ" || callType === "For Sched") {
            options.push({
                value: "Assisted",
                title: "Assisted",
                desc: "Client was assisted and provided with the needed information or support.",
            });
        }
        
        // For Not Connected With The Company → Approval for TSM
        if (callType === "Not Connected With The Company") {
            options.push({
                value: "Approval for TSM",
                title: "Approval for TSM",
                desc: "Client is no longer associated with the company - awaiting TSM approval.",
            });
        }
        
        // For Cannot Be Reached → Approval for TSM
        if (callType === "Cannot Be Reached") {
            options.push({
                value: "Approval for TSM",
                title: "Approval for TSM",
                desc: "Client cannot be reached — subject to TSM approval.",
            });
        }
        
        // For Unsuccessful callStatus (other than Cannot Be Reached) → Completed
        if (callStatus === "Unsuccessful" && callType !== "Cannot Be Reached") {
            options.push({
                value: "Completed",
                title: "Completed",
                desc: "Call attempt was completed — client was not reached.",
            });
        }
        
        return options;
    }, [callType, callStatus]);


    return (
        <>
            {/* Settings Button - Top Right */}
            <div className="flex justify-end mb-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="rounded-none flex items-center gap-2"
                    onClick={handleSettingsClick}
                >
                    <Settings className="w-4 h-4" />
                    Settings
                    {settingsUnlocked && <span className="ml-1 text-xs text-green-600">(Unlocked)</span>}
                </Button>
            </div>

            {/* Password Dialog */}
            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogContent className="rounded-none max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lock className="w-5 h-5" />
                            Authentication Required
                        </DialogTitle>
                        <DialogDescription>
                            Enter the password to access settings.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 space-y-4">
                        <div className="relative">
                            <Input
                                type={showPassword ? "text" : "password"}
                                value={passwordInput}
                                onChange={(e) => {
                                    setPasswordInput(e.target.value);
                                    setPasswordError(false);
                                }}
                                placeholder="Enter password"
                                className="rounded-none pr-10"
                                onKeyDown={(e) => e.key === "Enter" && verifyPassword()}
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                        </div>
                        {passwordError && (
                            <p className="text-sm text-red-600">Incorrect password. Please try again.</p>
                        )}
                    </div>
                    <DialogFooter className="flex gap-2">
                        <Button
                            variant="outline"
                            className="rounded-none"
                            onClick={() => {
                                setPasswordDialogOpen(false);
                                setPasswordInput("");
                                setPasswordError(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="rounded-none"
                            onClick={verifyPassword}
                        >
                            <Lock className="w-4 h-4 mr-1" />
                            Unlock
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Settings Dialog */}
            <Dialog open={settingsOpen} onOpenChange={(open) => {
                if (!open) lockSettings();
                setSettingsOpen(open);
            }}>
                <DialogContent className="rounded-none !w-[98vw] !h-[98vh] !max-w-[50vw] !max-h-[98vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                Outbound Sheet Settings
                            </span>
                            {settingsUnlocked && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                    Unlocked
                                </span>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Customize the outbound sheet behavior and appearance.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {/* Settings Tabs */}
                    <div className="flex border-b mb-4">
                        {[
                            { id: "general", label: "General", icon: CheckSquare },
                            { id: "dates", label: "Dates", icon: Calendar },
                            { id: "calltypes", label: "Call Types", icon: Filter },
                            { id: "validation", label: "Validation", icon: Shield },
                            { id: "ui", label: "UI", icon: Palette },
                            { id: "notifications", label: "Notifications", icon: Bell },
                            { id: "templates", label: "Templates", icon: FileText },
                            { id: "security", label: "Security", icon: Lock },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveSettingsTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    activeSettingsTab === tab.id
                                        ? "border-cyan-500 text-cyan-700"
                                        : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    
                    {/* Settings Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* General Settings */}
                        {activeSettingsTab === "general" && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">General Settings</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.autoSave}
                                            onChange={(e) => updateSetting("autoSave", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Auto Save</p>
                                            <p className="text-sm text-gray-500">Automatically save on completion</p>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.confirmBeforeSave}
                                            onChange={(e) => updateSetting("confirmBeforeSave", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Confirm Before Save</p>
                                            <p className="text-sm text-gray-500">Show confirmation dialog</p>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.showStepIndicator}
                                            onChange={(e) => updateSetting("showStepIndicator", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Show Step Indicator</p>
                                            <p className="text-sm text-gray-500">Display current step progress</p>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.enableKeyboardShortcuts}
                                            onChange={(e) => updateSetting("enableKeyboardShortcuts", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Keyboard Shortcuts</p>
                                            <p className="text-sm text-gray-500">Enable keyboard navigation</p>
                                        </div>
                                    </label>
                                </div>
                                
                            </div>
                        )}
                        
                        {/* Date Settings */}
                        {activeSettingsTab === "dates" && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Date & Time Settings</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.skipSundays}
                                            onChange={(e) => updateSetting("skipSundays", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Skip Sundays</p>
                                            <p className="text-sm text-gray-500">Move Sunday dates to Monday</p>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.skipHolidays}
                                            onChange={(e) => updateSetting("skipHolidays", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Skip Holidays</p>
                                            <p className="text-sm text-gray-500">Move holiday dates to next working day</p>
                                        </div>
                                    </label>
                                </div>
                                
                                <div className="p-4 bg-gray-50 rounded">
                                    <h4 className="font-medium mb-3">Follow-Up Days Configuration</h4>
                                    <p className="text-sm text-gray-500 mb-4">
                                        Set default follow-up days for each call type (0 = today)
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {Object.entries(settings.followUpDays).map(([type, days]) => (
                                            <div key={type} className="flex items-center gap-3">
                                                <label className="flex-1 text-sm">{type}:</label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max="365"
                                                    value={days}
                                                    onChange={(e) => updateFollowUpDays(type as keyof typeof settings.followUpDays, parseInt(e.target.value) || 0)}
                                                    className="w-20 rounded-none"
                                                />
                                                <span className="text-sm text-gray-500">days</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Date Format</label>
                                        <select
                                            value={settings.dateFormat}
                                            onChange={(e) => updateSetting("dateFormat", e.target.value)}
                                            className="w-full p-2 border rounded-none"
                                        >
                                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Time Zone</label>
                                        <select
                                            value={settings.timeZone}
                                            onChange={(e) => updateSetting("timeZone", e.target.value)}
                                            className="w-full p-2 border rounded-none"
                                        >
                                            <option value="Asia/Manila">Asia/Manila (PHT)</option>
                                            <option value="UTC">UTC</option>
                                            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                                            <option value="America/New_York">America/New_York (EST)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Call Types Settings */}
                        {activeSettingsTab === "calltypes" && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Call Type Configuration</h3>
                                
                                <div className="p-4 bg-cyan-50 rounded border border-cyan-200">
                                    <h4 className="font-medium mb-3 text-cyan-800">Successful Call Types</h4>
                                    <div className="space-y-2">
                                        {Object.entries(settings.enabledCallTypes.successful).map(([type, enabled]) => (
                                            <label key={type} className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={enabled}
                                                    onChange={(e) => toggleCallType("successful", type, e.target.checked)}
                                                    className="w-4 h-4"
                                                />
                                                <span>{type}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-gray-50 rounded border border-gray-200">
                                    <h4 className="font-medium mb-3">Unsuccessful Call Types</h4>
                                    <div className="space-y-2">
                                        {Object.entries(settings.enabledCallTypes.unsuccessful).map(([type, enabled]) => (
                                            <label key={type} className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={enabled}
                                                    onChange={(e) => toggleCallType("unsuccessful", type, e.target.checked)}
                                                    className="w-4 h-4"
                                                />
                                                <span>{type}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-gray-50 rounded">
                                    <h4 className="font-medium mb-3">Status Mapping</h4>
                                    <p className="text-sm text-gray-500 mb-4">
                                        Default status for each call type
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {Object.entries(settings.statusMapping).map(([callType, mappedStatus]) => (
                                            <div key={callType} className="flex items-center gap-3">
                                                <label className="flex-1 text-sm">{callType}:</label>
                                                <select
                                                    value={mappedStatus}
                                                    onChange={(e) => updateStatusMapping(callType as keyof typeof settings.statusMapping, e.target.value)}
                                                    className="w-40 p-2 border rounded-none text-sm"
                                                >
                                                    <option value="Completed">Completed</option>
                                                    <option value="Assisted">Assisted</option>
                                                    <option value="Approval for TSM">Approval for TSM</option>
                                                                                                        <option value="Pending">Pending</option>
                                                    <option value="In Progress">In Progress</option>
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Validation Settings */}
                        {activeSettingsTab === "validation" && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Validation Settings</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.requireRemarks}
                                            onChange={(e) => updateSetting("requireRemarks", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Require Remarks</p>
                                            <p className="text-sm text-gray-500">Make remarks mandatory</p>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.requireFollowUpDate}
                                            onChange={(e) => updateSetting("requireFollowUpDate", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Require Follow-Up Date</p>
                                            <p className="text-sm text-gray-500">Make follow-up date mandatory</p>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.blockBackdatedFollowUp}
                                            onChange={(e) => updateSetting("blockBackdatedFollowUp", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Block Backdated Dates</p>
                                            <p className="text-sm text-gray-500">Prevent selecting past dates</p>
                                        </div>
                                    </label>
                                </div>
                                
                                <div className="p-4 bg-gray-50 rounded">
                                    <label className="block mb-2">
                                        <span className="font-medium">Minimum Remarks Length</span>
                                        <span className="text-sm text-gray-500 ml-2">(characters)</span>
                                    </label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="1000"
                                        value={settings.minRemarksLength}
                                        onChange={(e) => updateSetting("minRemarksLength", parseInt(e.target.value) || 0)}
                                        className="w-32 rounded-none"
                                    />
                                </div>
                            </div>
                        )}
                        
                        {/* UI Settings */}
                        {activeSettingsTab === "ui" && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">UI Preferences</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Theme</label>
                                        <select
                                            value={settings.theme}
                                            onChange={(e) => updateSetting("theme", e.target.value)}
                                            className="w-full p-2 border rounded-none"
                                        >
                                            <option value="default">Default</option>
                                            <option value="light">Light</option>
                                            <option value="dark">Dark</option>
                                            <option value="high-contrast">High Contrast</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Accent Color</label>
                                        <select
                                            value={settings.accentColor}
                                            onChange={(e) => updateSetting("accentColor", e.target.value)}
                                            className="w-full p-2 border rounded-none"
                                        >
                                            <option value="cyan">Cyan</option>
                                            <option value="blue">Blue</option>
                                            <option value="green">Green</option>
                                            <option value="purple">Purple</option>
                                            <option value="orange">Orange</option>
                                            <option value="red">Red</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.compactMode}
                                            onChange={(e) => updateSetting("compactMode", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Compact Mode</p>
                                            <p className="text-sm text-gray-500">Reduce spacing and padding</p>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.showDescriptions}
                                            onChange={(e) => updateSetting("showDescriptions", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Show Descriptions</p>
                                            <p className="text-sm text-gray-500">Display field descriptions</p>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.animationEnabled}
                                            onChange={(e) => updateSetting("animationEnabled", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Enable Animations</p>
                                            <p className="text-sm text-gray-500">Show transition animations</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}
                        
                        {/* Notifications Settings */}
                        {activeSettingsTab === "notifications" && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Notification Settings</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.enableNotifications}
                                            onChange={(e) => updateSetting("enableNotifications", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Enable Notifications</p>
                                            <p className="text-sm text-gray-500">Show toast notifications</p>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.soundOnSave}
                                            onChange={(e) => updateSetting("soundOnSave", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Sound on Save</p>
                                            <p className="text-sm text-gray-500">Play sound when saving</p>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.showSuccessToast}
                                            onChange={(e) => updateSetting("showSuccessToast", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Success Toast</p>
                                            <p className="text-sm text-gray-500">Show success message after save</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}
                        
                        {/* Templates Settings */}
                        {activeSettingsTab === "templates" && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Remarks Templates</h3>
                                <p className="text-sm text-gray-500">
                                    Pre-defined templates for quick remarks entry
                                </p>
                                
                                <div className="space-y-2">
                                    {settings.remarksTemplates.map((template, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Input
                                                value={template}
                                                onChange={(e) => {
                                                    const newTemplates = [...settings.remarksTemplates];
                                                    newTemplates[index] = e.target.value;
                                                    updateSetting("remarksTemplates", newTemplates);
                                                }}
                                                className="flex-1 rounded-none"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    const newTemplates = settings.remarksTemplates.filter((_, i) => i !== index);
                                                    updateSetting("remarksTemplates", newTemplates);
                                                }}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        updateSetting("remarksTemplates", [...settings.remarksTemplates, ""]);
                                    }}
                                    className="rounded-none"
                                >
                                    + Add Template
                                </Button>
                            </div>
                        )}
                        
                        {/* Security Settings */}
                        {activeSettingsTab === "security" && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Security Settings</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.requirePasswordForSettings}
                                            onChange={(e) => updateSetting("requirePasswordForSettings", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Password Protection</p>
                                            <p className="text-sm text-gray-500">Require password for settings</p>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={settings.autoLockSettings}
                                            onChange={(e) => updateSetting("autoLockSettings", e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        <div>
                                            <p className="font-medium">Auto Lock</p>
                                            <p className="text-sm text-gray-500">Lock after inactivity</p>
                                        </div>
                                    </label>
                                </div>
                                
                                <div className="p-4 bg-gray-50 rounded">
                                    <label className="block mb-2">
                                        <span className="font-medium">Lock Timeout</span>
                                        <span className="text-sm text-gray-500 ml-2">(minutes)</span>
                                    </label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="60"
                                        value={settings.lockTimeoutMinutes}
                                        onChange={(e) => updateSetting("lockTimeoutMinutes", parseInt(e.target.value) || 5)}
                                        className="w-32 rounded-none"
                                    />
                                </div>
                                
                                <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
                                    <h4 className="font-medium mb-2 text-yellow-800 flex items-center gap-2">
                                        <Lock className="w-4 h-4" />
                                        Change Settings Password
                                    </h4>
                                    <p className="text-sm text-yellow-700 mb-3">
                                        Current password is required to change
                                    </p>
                                    <div className="flex gap-2">
                                        <Input
                                            type="password"
                                            placeholder="New password"
                                            className="flex-1 rounded-none"
                                        />
                                        <Button
                                            variant="outline"
                                            className="rounded-none"
                                            onClick={() => alert("Password change feature - implement as needed")}
                                        >
                                            Update
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Settings Footer */}
                    <DialogFooter className="flex justify-between items-center border-t pt-4">
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="rounded-none"
                                onClick={resetSettings}
                            >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Reset to Default
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="rounded-none"
                                onClick={lockSettings}
                            >
                                <Lock className="w-4 h-4 mr-1" />
                                Lock & Close
                            </Button>
                            <Button
                                className="rounded-none"
                                onClick={() => {
                                    // Settings are already saved to localStorage via useEffect
                                    // Just show confirmation if enabled
                                    if (settings.enableNotifications && settings.showSuccessToast) {
                                        alert("Settings saved successfully!");
                                    }
                                    lockSettings();
                                }}
                            >
                                <Save className="w-4 h-4 mr-1" />
                                Save & Close
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* STEP 2 */}
            {step === 2 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3">Step 2 — Source</h2>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Source</FieldLabel>
                            <FieldDescription>
                                Select the source of the outbound call. This helps categorize the call type for reporting and analytics.
                            </FieldDescription>
                            <RadioGroup
                                value={source}
                                onValueChange={props.setSource}
                                className="space-y-4"
                            >
                                {STEP2_SOURCES.map((item) => (
                                    <FieldLabel key={item.value}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {source === item.value && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button variant="outline" className="rounded-none" onClick={props.handleBack}>
                                                            <ArrowLeft /> Back
                                                        </Button>
                                                        <Button className="rounded-none" onClick={onNextClick}>
                                                            Next <ArrowRight />
                                                        </Button>
                                                    </div>
                                                )}
                                            </FieldContent>
                                            <RadioGroupItem value={item.value} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>
                </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3">Step 3 — Call Details</h2>

                    <Alert
                        variant="default"
                        className="mb-4 flex flex-col gap-4 border-cyan-300 border-2 bg-cyan-50 rounded-lg p-4 shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 mr-6">
                                <div className="flex flex-col">
                                    <AlertTitle className="font-semibold text-gray-800 flex items-center gap-2">
                                        Contact #
                                    </AlertTitle>
                                    <AlertDescription className="text-gray-600">{props.contact_number}</AlertDescription>
                                </div>
                            </div>
                        </div>
                    </Alert>

                    <FieldGroup className="mt-4">
                        <FieldSet>
                            <FieldLabel className="font-bold">Call Status</FieldLabel>
                            <FieldDescription>
                                Select the status of the call to indicate if the client was reached or not.
                            </FieldDescription>
                            <RadioGroup
                                value={callStatus}
                                onValueChange={props.setCallStatus}
                            >
                                {STEP3_CALL_STATUS.map((item) => (
                                    <FieldLabel key={item.value}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {callStatus === item.value && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button variant="outline" className="rounded-none" onClick={props.handleBack}>
                                                            <ArrowLeft /> Back
                                                        </Button>
                                                        <Button className="rounded-none" onClick={onNextClick}>
                                                            Next <ArrowRight />
                                                        </Button>
                                                    </div>
                                                )}
                                            </FieldContent>
                                            <RadioGroupItem value={item.value} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>
                </div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3">Step 4 — Call Details</h2>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Call Type</FieldLabel>
                            <FieldDescription>
                                Choose the type of call outcome based on the client's response and situation.
                            </FieldDescription>
                            <RadioGroup
                                value={callType}
                                onValueChange={props.setCallType}
                            >
                                {(
                                    callStatus === "Successful"
                                        ? STEP4_SUCCESSFUL_TYPES
                                        : callStatus === "Unsuccessful"
                                            ? STEP4_UNSUCCESSFUL_TYPES
                                            : []
                                ).map((item) => (
                                    <FieldLabel key={item.value}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {callType === item.value && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button variant="outline" className="rounded-none" onClick={props.handleBack}>
                                                            <ArrowLeft /> Back
                                                        </Button>
                                                        <Button className="rounded-none" onClick={onNextClick}>
                                                            Next <ArrowRight />
                                                        </Button>
                                                    </div>
                                                )}
                                            </FieldContent>
                                            <RadioGroupItem value={item.value} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>

                        </FieldSet>
                    </FieldGroup>
                </div>
            )}

            {/* STEP 5 */}
            {step === 5 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3">Step 5 — Remarks & Status</h2>

                    {/* Follow Up Date alert — only for Successful calls (not for Not Connected) */}
                    {callStatus === "Successful" && followUpDate && callType !== "For Sched" && callType !== "Not Connected With The Company" ? (
                        <Alert variant="default" className="mb-4 flex flex-col gap-3 border-cyan-300 border-3 bg-cyan-100">
                            <div>
                                <AlertTitle className="font-bold">Follow Up Date:</AlertTitle>
                                <AlertDescription>
                                    {followUpDate} — This is the scheduled date to reconnect with the client.
                                </AlertDescription>
                            </div>
                        </Alert>
                    ) : null}

                    {/* Follow Up Date alert — only for Unsuccessful calls (not for Not Connected) */}
                    {callStatus === "Unsuccessful" && followUpDate ? (
                        <Alert variant="default" className="mb-4 flex flex-col gap-3 border-cyan-300 border-3 bg-cyan-100">
                            <div>
                                <AlertTitle className="font-bold">Follow Up Date:</AlertTitle>
                                <AlertDescription>
                                    {followUpDate} — This is the scheduled date to reconnect with the client.
                                </AlertDescription>
                            </div>
                        </Alert>
                    ) : null}

                    {/* Date picker for For Sched */}
                    {callType === "For Sched" && (
                        <FieldGroup className="mb-4">
                            <FieldSet>
                                <FieldLabel className="font-bold">Schedule Date</FieldLabel>
                                <FieldDescription>
                                    {settings.blockBackdatedFollowUp 
                                        ? "Select a follow-up date (today or future dates only)." 
                                        : "Select a follow-up date (any date)."}
                                </FieldDescription>
                                <Input
                                    type="date"
                                    value={followUpDate}
                                    min={settings.blockBackdatedFollowUp ? todayString : undefined}
                                    onChange={(e) => props.setFollowUpDate(e.target.value)}
                                    className="rounded-none"
                                    required={settings.requireFollowUpDate}
                                />
                            </FieldSet>
                        </FieldGroup>
                    )}

                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Remarks</FieldLabel>
                            <FieldDescription>
                                Add any additional notes or important details about the call or client interaction.
                            </FieldDescription>
                            {/* Template Suggestions */}
                            {settings.remarksTemplates.length > 0 && (
                                <div className="mb-2">
                                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                        <MessageSquare className="w-3 h-3" />
                                        Quick templates (click to apply):
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {settings.remarksTemplates
                                            .filter(t => t.trim())
                                            .map((template, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => props.setRemarks(template)}
                                                    className="text-xs bg-gray-100 hover:bg-cyan-100 text-gray-700 hover:text-cyan-700 px-2 py-1 rounded border transition-colors"
                                                    type="button"
                                                >
                                                    {template.length > 30 ? template.substring(0, 30) + "..." : template}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}
                            <Textarea
                                value={remarks}
                                onChange={(e) => props.setRemarks(e.target.value)}
                                placeholder="Enter remarks or click a template above"
                                required={settings.requireRemarks}
                                minLength={settings.minRemarksLength}
                                className="capitalize rounded-none"
                            />
                            {settings.requireRemarks && settings.minRemarksLength > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Minimum {settings.minRemarksLength} characters required
                                </p>
                            )}
                        </FieldSet>
                    </FieldGroup>

                    <FieldGroup className="mt-4">
                        <FieldSet>
                            <FieldLabel>Status</FieldLabel>
                            <FieldDescription>
                                Select the final status of this call.
                            </FieldDescription>
                            <RadioGroup value={status} onValueChange={props.setStatus} className="space-y-4">
                                {statusOptions.map((item) => (
                                    <FieldLabel key={item.value}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {status === item.value && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button type="button" variant="outline" className="rounded-none" onClick={props.handleBack}>
                                                            <ArrowLeft /> Back
                                                        </Button>
                                                        <Button type="button" className="rounded-none" onClick={onSaveClick}>
                                                            <CheckCircle2Icon /> Save
                                                        </Button>
                                                    </div>
                                                )}
                                            </FieldContent>
                                            <RadioGroupItem value={item.value} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>

                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogContent className="rounded-none">
                            <DialogHeader>
                                <DialogTitle className="text-red-600">Validation Error</DialogTitle>
                                <DialogDescription>{dialogMessage}</DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button className="rounded-none" onClick={() => setDialogOpen(false)}>OK</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            )}
        </>
    );
}
