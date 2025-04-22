"use client"

import { useState, useEffect } from "react"
import { FileText, MessageSquare, Plus, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChatInterface } from "@/components/chat-interface"
import { PDFUploader } from "@/components/pdf-uploader"
import { Toaster } from "@/components/ui/toaster"
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar"

interface PDF {
  id: string
  name: string
  size: number
}

interface Message {
  role: "user" | "assistant"
  content: string
  sources?: {
    pdfName: string
    pdfId: string
    snippet: string
  }[]
}

export default function ChatPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("chat")
  const [pdfs, setPdfs] = useState<PDF[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [activePdf, setActivePdf] = useState<string | null>(null)
  const [isAllPdfs, setIsAllPdfs] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])

  // Load PDFs from localStorage on initial render
  useEffect(() => {
    const savedPdfs = localStorage.getItem("pdfs")
    if (savedPdfs) {
      setPdfs(JSON.parse(savedPdfs))
    }
  }, [])

  // Save PDFs to localStorage when they change
  useEffect(() => {
    localStorage.setItem("pdfs", JSON.stringify(pdfs))
  }, [pdfs])

  const handleUploadSuccess = (pdf: PDF) => {
    setPdfs((prev) => [...prev, pdf])

    // Set the first PDF as active if none is selected
    if (!activePdf && !isAllPdfs) {
      setActivePdf(pdf.id)
    }
  }

  const handleRemovePdf = (id: string) => {
    setPdfs((prev) => prev.filter((pdf) => pdf.id !== id))

    if (activePdf === id) {
      const remaining = pdfs.filter((pdf) => pdf.id !== id)
      if (remaining.length > 0) {
        setActivePdf(remaining[0].id)
      } else {
        setActivePdf(null)
      }
    }
  }

  const handleSelectPdf = (id: string | null) => {
    setActivePdf(id)
    setIsAllPdfs(false)
    setMessages([])
  }

  const handleSelectAllPdfs = () => {
    setActivePdf(null)
    setIsAllPdfs(true)
    setMessages([])
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
  {/* Sidebar with border and fixed width */}
        <Sidebar className="border-r bg-white w-[250px] min-w-[200px] max-w-[320px] flex-shrink-0 h-full">
          <SidebarHeader>
            <div className="flex items-center px-2">
              <h2 className="text-lg font-semibold">PDFChat</h2>
            </div>
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Your PDFs</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {pdfs.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground">No PDFs uploaded yet</div>
                  ) : (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton isActive={isAllPdfs} onClick={handleSelectAllPdfs}>
                          <div className="flex items-center gap-2">
                            <FileText size={16} />
                            <span>All PDFs</span>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>

                      {pdfs.map((pdf) => (
                        <SidebarMenuItem key={pdf.id}>
                          <SidebarMenuButton
                            isActive={activePdf === pdf.id}
                            onClick={() => handleSelectPdf(pdf.id)}
                            className="justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <FileText size={16} />
                              <span className="truncate">{pdf.name}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemovePdf(pdf.id)
                              }}
                            >
                              <X size={14} />
                            </Button>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </>
                  )}
                </SidebarMenu>
                <div className="px-2 pt-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => setActiveTab("upload")}
                  >
                    <Plus size={16} />
                    <span>Upload PDF</span>
                  </Button>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Chat History</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => {
                        setMessages([])
                      }}
                    >
                      <MessageSquare size={16} />
                      <span>New Chat</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="px-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => router.push("/")}>
                Back to Home
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col overflow-hidden p-4 md:p-8 bg-background min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col"> {/* Added flex flex-col */}
            <div className="border-b px-4">
              <TabsList className="h-12">
                <TabsTrigger value="chat" className="gap-2">
                  <MessageSquare size={16} />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-2">
                  <Upload size={16} />
                  Upload
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="chat"
              className="flex-1 overflow-hidden p-0 data-[state=active]:flex-1 data-[state=active]:flex data-[state=active]:flex-col"
            >
              {/* Empty state is fully centered in the main area */}
              {pdfs.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center min-h-[400px]">
                  <FileText size={48} className="text-muted-foreground" />
                  <h3 className="text-xl font-semibold">No PDFs Uploaded</h3>
                  <p className="max-w-md text-muted-foreground">
                    Upload PDFs to start chatting with your documents. You can ask questions and get answers based on
                    the content.
                  </p>
                  <Button onClick={() => setActiveTab("upload")}>Upload PDFs</Button>
                </div>
              ) : (
                <ChatInterface
                  messages={messages}
                  setMessages={setMessages}
                  activePdf={activePdf ? pdfs.find((p) => p.id === activePdf) || null : null}
                  isAllPdfs={isAllPdfs}
                />
              )}
            </TabsContent>

            <TabsContent value="upload" className="flex-1 overflow-hidden"> {/* Added flex-1 and overflow-hidden */}
              <PDFUploader
                onUploadSuccess={handleUploadSuccess}
                isUploading={isUploading}
                setIsUploading={setIsUploading}
                pdfs={pdfs}
                onRemove={handleRemovePdf}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  )
}
