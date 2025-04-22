"use client"

import { useState } from "react"
import { ArrowLeft, FileText, Loader2 } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChatInterface } from "@/components/chat-interface"

export default function DemoPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [demoStarted, setDemoStarted] = useState(false)
  const [activeTab, setActiveTab] = useState("chat")
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([])

  const startDemo = () => {
    setIsLoading(true)

    // Simulate loading demo PDF
    setTimeout(() => {
      setIsLoading(false)
      setDemoStarted(true)

      // Add initial assistant message
      setMessages([
        {
          role: "assistant",
          content:
            "I've loaded a sample financial report PDF. You can ask me questions about it, request summaries, or extract key information.",
        },
      ])
    }, 2000)
  }

  const handleSendMessage = (message: string) => {
    if (!message.trim()) return

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: message }])

    // Simulate AI response based on the question
    setTimeout(() => {
      let response = ""

      if (message.toLowerCase().includes("summary")) {
        response =
          "Executive Summary of Financial Report 2023:\n\n• Revenue increased by 15% year-over-year to $42.5M\n• Operating margin improved to 23.4% from 19.8% last year\n• New product lines contributed $8.2M in additional revenue\n• International expansion in APAC region exceeded targets by 12%\n• Projected growth for next fiscal year is 18-20%"
      } else if (message.toLowerCase().includes("table") || message.toLowerCase().includes("data")) {
        response =
          "I found the following key financial data in the report:\n\nQuarterly Revenue (in millions):\nQ1: $9.8M\nQ2: $10.5M\nQ3: $11.2M\nQ4: $11.0M\n\nExpenses by Category:\n- R&D: 24%\n- Marketing: 30%\n- Operations: 32%\n- Admin: 14%"
      } else if (message.toLowerCase().includes("recommendation") || message.toLowerCase().includes("suggest")) {
        response =
          "Based on the financial report, the key recommendations are:\n\n1. Increase investment in the APAC region which showed 27% growth\n2. Continue R&D focus on the new product lines that exceeded expectations\n3. Consider strategic acquisitions in the software services sector\n4. Implement cost optimization in administrative operations"
      } else {
        response =
          "According to the financial report, the company has shown strong performance in the last fiscal year with 15% revenue growth. The report highlights successful expansion into new markets, particularly in the Asia-Pacific region. The board has approved a dividend increase of 5% for shareholders."
      }

      setMessages((prev) => [...prev, { role: "assistant", content: response }])
    }, 1000)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-14 items-center">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
          <div className="ml-auto">
            <Button size="sm" asChild>
              <Link href="/chat">Try with Your PDFs</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {!demoStarted ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <Card className="mx-auto max-w-md p-6 text-center">
              <FileText size={48} className="mx-auto mb-4 text-primary" />
              <h1 className="mb-2 text-2xl font-bold">Demo Mode</h1>
              <p className="mb-6 text-muted-foreground">
                Try out our PDF chat functionality with a sample financial report
              </p>
              <Button onClick={startDemo} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Loading Demo...
                  </>
                ) : (
                  "Start Demo"
                )}
              </Button>
            </Card>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <div className="border-b px-4">
                <TabsList className="h-12">
                  <TabsTrigger value="chat" className="gap-2">
                    Chat with Financial Report
                  </TabsTrigger>
                  <TabsTrigger value="summary" className="gap-2">
                    Summary
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chat" className="flex-1 data-[state=active]:flex data-[state=active]:flex-col">
                <ChatInterface
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  activePdf="Financial Report 2023.pdf"
                />
              </TabsContent>

              <TabsContent value="summary" className="p-6">
                <Card className="p-6">
                  <h2 className="mb-4 text-xl font-bold">Financial Report 2023 - Executive Summary</h2>
                  <div className="space-y-4">
                    <p>
                      This annual financial report presents a comprehensive overview of the company's financial
                      performance for the fiscal year 2023. The report highlights significant growth across key business
                      segments and geographical regions.
                    </p>
                    <h3 className="text-lg font-semibold">Key Highlights:</h3>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Revenue increased by 15% year-over-year to $42.5M</li>
                      <li>Operating margin improved to 23.4% from 19.8% last year</li>
                      <li>New product lines contributed $8.2M in additional revenue</li>
                      <li>International expansion in APAC region exceeded targets by 12%</li>
                      <li>Projected growth for next fiscal year is 18-20%</li>
                    </ul>
                    <h3 className="text-lg font-semibold">Quarterly Performance:</h3>
                    <div className="rounded-md border">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="px-4 py-2 text-left">Quarter</th>
                            <th className="px-4 py-2 text-left">Revenue</th>
                            <th className="px-4 py-2 text-left">Growth</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="px-4 py-2">Q1 2023</td>
                            <td className="px-4 py-2">$9.8M</td>
                            <td className="px-4 py-2">+12%</td>
                          </tr>
                          <tr className="border-b">
                            <td className="px-4 py-2">Q2 2023</td>
                            <td className="px-4 py-2">$10.5M</td>
                            <td className="px-4 py-2">+15%</td>
                          </tr>
                          <tr className="border-b">
                            <td className="px-4 py-2">Q3 2023</td>
                            <td className="px-4 py-2">$11.2M</td>
                            <td className="px-4 py-2">+18%</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2">Q4 2023</td>
                            <td className="px-4 py-2">$11.0M</td>
                            <td className="px-4 py-2">+14%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  )
}
