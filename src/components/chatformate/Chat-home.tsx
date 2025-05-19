"use client";
import React, { useState, useRef, useEffect } from 'react';
import { FileUpload } from "../FileUpload";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../ui/table";
import {

    CardHeader,
    CardTitle,
} from "../ui/card";

import { Spinner } from "../ui/spinner";
import {

    Send,
    Edit2,
    Save,
    Trash2,
    PlusCircle,
    Copy,
    Check
} from "lucide-react";

type Message = {
    role: "user" | "assistant";
    content: string;
    isSkillsTable?: boolean;
};

type Skill = {
    id?: string;
    name: string;
    level: "BEGINNER" | "INTERMEDIATE" | "PROFESSIONAL";
    requirement: "MANDATORY" | "OPTIONAL";
    numQuestions: number;
    isEditing?: boolean;
};

export default function Chathome() {
    // State
    const [messages, setMessages] = useState<Message[]>([]);
    const [pdfContent, setPdfContent] = useState<string | null>(null);
    const [inputMessage, setInputMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [isSkillsExtracted, setIsSkillsExtracted] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);

    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom of chat when messages change
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Handle file upload
    const handleFileUploaded = async (url: string) => {
        try {
            setIsLoading(true);

            // Extract content from the PDF using existing API
            const extractResponse = await fetch("/api/pdf-extract", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ resumeUrl: url }),
            });

            if (!extractResponse.ok) {
                throw new Error("Failed to extract PDF content");
            }

            const { content } = await extractResponse.json();
            setPdfContent(content);

            // Add message to chat
            addMessage("assistant", "Job description uploaded successfully! You can now extract skills or ask questions about the job description.");
        } catch (error) {
            console.error("Error processing file:", error);
            addMessage("assistant", "Error processing the file. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Add a message to the chat
    const addMessage = (role: "user" | "assistant", content: string, isSkillsTable: boolean = false) => {
        setMessages(prev => [...prev, { role, content, isSkillsTable }]);
    };

    // Extract skills from job description
    const extractSkills = async () => {
        if (!pdfContent) {
            addMessage("assistant", "Please upload a job description first.");
            return;
        }

        setIsExtracting(true);
        addMessage("user", "Extract skills from this job description");

        try {
            const response = await fetch("/api/extract-skills", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    jobDescription: pdfContent,
                    jobTitle: "Job Position", // Default title, could be extracted from chat
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to extract skills");
            }

            const data = await response.json();

            if (data.success && data.analysis?.skills) {
                const extractedSkills = data.analysis.skills.map((skill: any) => ({
                    ...skill,
                    isEditing: false,
                    numQuestions: 1
                }));

                setSkills(extractedSkills);
                setIsSkillsExtracted(true);
                addMessage("assistant", "Skills extracted successfully! You can now edit them or generate interview questions.");
                // Add skills table as a special message
                addMessage("assistant", "", true);
            } else {
                throw new Error(data.error || "Failed to extract skills");
            }
        } catch (error) {
            console.error("Error extracting skills:", error);
            addMessage("assistant", "Error extracting skills. Please try again.");
        } finally {
            setIsExtracting(false);
        }
    };

    // Handle form submission (chat message)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!inputMessage.trim()) return;

        // Add user message to chat
        addMessage("user", inputMessage);
        setInputMessage("");
        setIsLoading(true);

        try {
            // Call chat API (you'll need to create this)
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: inputMessage,
                    jobDescription: pdfContent,
                    skills: isSkillsExtracted ? skills : undefined,
                    chatHistory: messages.filter(msg => !msg.isSkillsTable).map(msg => ({
                        role: msg.role,
                        content: msg.content
                    }))
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to get response");
            }

            const data = await response.json();
            addMessage("assistant", data.message);
        } catch (error) {
            console.error("Error in chat:", error);
            addMessage("assistant", "Sorry, I encountered an error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Handle skill editing
    const toggleEditSkill = (index: number) => {
        setSkills(skills.map((skill, i) =>
            i === index ? { ...skill, isEditing: !skill.isEditing } : skill
        ));
    };

    const updateSkill = (index: number, field: keyof Skill, value: any) => {
        setSkills(skills.map((skill, i) =>
            i === index ? { ...skill, [field]: value } : skill
        ));
    };

    const addNewSkill = () => {
        setSkills([
            ...skills,
            {
                name: "",
                level: "INTERMEDIATE",
                requirement: "OPTIONAL",
                numQuestions: 1,
                isEditing: true
            }
        ]);
    };

    const deleteSkill = (index: number) => {
        setSkills(skills.filter((_, i) => i !== index));
    };

    const generateQuestions = async () => {
        if (!isSkillsExtracted || skills.length === 0) {
            addMessage("assistant", "Please extract and edit skills first");
            return;
        }

        setIsLoading(true);
        addMessage("user", "Generate interview questions based on these skills");

        try {
            const response = await fetch("/api/generate-questions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    jobRole: "Job Position",
                    jobDescription: pdfContent,
                    skills: skills,
                    customInstructions: "Generate targeted interview questions for the extracted skills."
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to generate questions");
            }

            const data = await response.json();

            if (data.success && data.questions) {
                let questionResponse = "Here are the interview questions based on the skills:\n\n";

                data.questions.forEach((q: any, i: number) => {
                    questionResponse += `${i + 1}. ${q.question}\n`;
                });

                addMessage("assistant", questionResponse);
            } else {
                throw new Error(data.error || "Failed to generate questions");
            }
        } catch (error) {
            console.error("Error generating questions:", error);
            addMessage("assistant", "Error generating questions. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Skills table rendering for chat
    const renderSkillsTable = () => {
        return (
            <div className="w-full bg-white dark:bg-gray-950 rounded-lg border p-2 sm:p-4">
                <div className="mb-2 sm:mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        {skills.length} skills extracted. Edit as needed:
                    </p>
                    <Button
                        onClick={addNewSkill}
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                    >
                        <PlusCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Add Skill
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Skill</TableHead>

                                <TableHead className="w-[80px] sm:w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {skills.map((skill, index) => (
                                <TableRow key={index}>
                                    <TableCell className="max-w-[180px] sm:max-w-none truncate">
                                        {skill.isEditing ? (
                                            <Input
                                                value={skill.name}
                                                onChange={(e) => updateSkill(index, 'name', e.target.value)}
                                                className="w-full text-xs sm:text-base"
                                            />
                                        ) : (
                                            <span className="text-xs sm:text-base">{skill.name}</span>
                                        )}
                                    </TableCell>

                                    <TableCell>
                                        <div className="flex space-x-1">
                                            {skill.isEditing ? (
                                                <Button
                                                    onClick={() => toggleEditSkill(index)}
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-6 w-6 sm:h-8 sm:w-8"
                                                >
                                                    <Save className="h-3 w-3 sm:h-4 sm:w-4" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={() => toggleEditSkill(index)}
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-6 w-6 sm:h-8 sm:w-8"
                                                >
                                                    <Edit2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                onClick={() => deleteSkill(index)}
                                                size="icon"
                                                variant="outline"
                                                className="text-destructive h-6 w-6 sm:h-8 sm:w-8"
                                            >
                                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    };

    // Update the renderMessage function to handle formatted text better
    const renderMessage = (content: string) => {
        if (!content) return null;

        // Split by section headers (### Something)
        const sections = content.split(/(?=###\s+[^#\n]+)/);

        return (
            <div className="space-y-4">
                {sections.map((section, sectionIndex) => {
                    // Check if section starts with a header
                    const headerMatch = section.match(/^###\s+([^#\n]+)/);

                    if (headerMatch) {
                        // This is a section with a header
                        const [headerFull, headerText] = headerMatch;
                        const contentAfterHeader = section.replace(headerFull, '').trim();

                        // Split the content into paragraphs/questions
                        const paragraphs = contentAfterHeader.split(/\n\s*\n+/).filter(p => p.trim());

                        return (
                            <div key={sectionIndex} className="mb-3">
                                <h3 className="font-semibold text-base mb-2">{headerText}</h3>
                                <div className="space-y-2 pl-1">
                                    {paragraphs.map((paragraph, pIndex) => {
                                        // Check if this is a numbered point (starts with number and period)
                                        const isNumberedPoint = paragraph.match(/^\d+\.\s+/);

                                        if (isNumberedPoint) {
                                            return (
                                                <p key={pIndex} className="mb-1">
                                                    {paragraph}
                                                </p>
                                            );
                                        } else {
                                            return (
                                                <p key={pIndex} className="mb-1">
                                                    {paragraph}
                                                </p>
                                            );
                                        }
                                    })}
                                </div>
                            </div>
                        );
                    } else {
                        // Just a regular paragraph, not starting with a header
                        return (
                            <div key={sectionIndex} className="whitespace-pre-line">
                                {section}
                            </div>
                        );
                    }
                })}
            </div>
        );
    };

    // Function to copy message content to clipboard
    const copyToClipboard = (content: string, index: number) => {
        navigator.clipboard.writeText(content).then(() => {
            setCopiedMessageIndex(index);
            setTimeout(() => {
                setCopiedMessageIndex(null);
            }, 2000);
        });
    };

    return (
        <div className="flex flex-col h-full w-full sm:w-[90%] mx-auto border border-border/50 rounded-lg shadow-md overflow-hidden bg-background/80 backdrop-blur-sm">
            <div className="flex h-full">
                {/* Chat Panel - Full Width */}
                <div className="flex flex-col w-full h-full">
                    <CardHeader className="px-3 sm:px-5 py-3 sm:py-4 border-b bg-card/50 backdrop-blur-sm">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            Chat with JD Assistant
                        </CardTitle>
                    </CardHeader>

                    {/* Chat Messages */}
                    <div
                        ref={chatContainerRef}
                        className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 sm:space-y-4"
                    >
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center px-4 sm:px-6">
                                <div className= " p-6 sm:p-8 rounded-2xl shadow-sm mb-6 w-full max-w-2xl">
                                    <h2 className="text-xl sm:text-3xl font-bold text-primary mb-3">Chat with JD Assistant</h2>
                                    <p className="text-sm sm:text-base text-muted-foreground mb-2">Upload a job description to get started.</p>
                                    <p className="text-xs sm:text-sm text-muted-foreground mb-6">Extract key skills and receive customized interview questions.</p>
                                    
                                    <div className="bg-card/80 backdrop-blur-sm p-4 rounded-xl border border-border/50">
                                        <div className="flex items-center gap-3 bg-background p-3 rounded-lg shadow-sm mb-3">
                                            <input
                                                type="text"
                                                disabled
                                                placeholder="Ask anything about the job description..."
                                                className="flex-1 bg-transparent outline-none text-sm sm:text-base text-muted-foreground placeholder:text-muted-foreground"
                                            />
                                        </div>
                                        
                                    </div>
                                </div>
                            </div>


                        )}



                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`${msg.isSkillsTable ? 'max-w-full sm:max-w-[95%]' : 'max-w-[90%] sm:max-w-[80%]'} rounded-lg p-2 sm:p-3 relative ${msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                        }`}
                                >
                                    {msg.role === 'assistant' && !msg.isSkillsTable && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="absolute top-1 right-1 sm:top-2 sm:right-2 h-5 w-5 sm:h-6 sm:w-6 opacity-70 hover:opacity-100"
                                            onClick={() => copyToClipboard(msg.content, index)}
                                        >
                                            {copiedMessageIndex === index ? (
                                                <Check className="h-2 w-2 sm:h-3 sm:w-3" />
                                            ) : (
                                                <Copy className="h-2 w-2 sm:h-3 sm:w-3" />
                                            )}
                                        </Button>
                                    )}
                                    <div className={`${msg.role === 'assistant' && !msg.isSkillsTable ? 'pr-6 sm:pr-8' : ''} text-xs sm:text-base`}>
                                        {msg.isSkillsTable ? (
                                            renderSkillsTable()
                                        ) : (
                                            renderMessage(msg.content)
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                                    <Spinner size="sm" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chat Controls */}
                    <div className="p-2 sm:p-4 border-t bg-background/80 backdrop-blur-sm">
                        {!pdfContent ? (
                            <div className="bg-card/30 p-3 rounded-xl border border-border/50 shadow-sm">
                                <FileUpload
                                    onFileUploaded={handleFileUploaded}
                                    acceptedFileTypes=".pdf"
                                    label="Upload Job Description"
                                />
                            </div>
                        ) : (
                            <>
                                <div className="flex space-x-2 mb-3">
                                    {pdfContent && !isSkillsExtracted && (
                                        <Button
                                            onClick={extractSkills}
                                            disabled={isExtracting}
                                            className="w-full text-xs sm:text-base bg-primary/90 hover:bg-primary text-primary-foreground transition-colors"
                                        >
                                            {isExtracting ? <Spinner size="sm" /> : 'Extract Skills'}
                                        </Button>
                                    )}
                                </div>

                                <form
                                    onSubmit={handleSubmit}
                                    className="w-full bg-card border border-border/50 rounded-xl flex items-center px-4 py-3 gap-3 shadow-sm"
                                >
                                    <input
                                        type="text"
                                        value={inputMessage}
                                        onChange={(e) => setInputMessage(e.target.value)}
                                        placeholder="Ask a question about the job..."
                                        disabled={isLoading}
                                        className="flex-1 bg-transparent outline-none text-sm sm:text-base placeholder:text-muted-foreground"
                                    />

                                    <button
                                        type="submit"
                                        disabled={isLoading || !inputMessage.trim()}
                                        className="bg-primary text-primary-foreground rounded-lg p-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                </form>

                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
