"use client"

import Link from "next/link"
import Image from "next/image"
import { CodeBlockHighlight } from "@/components/code-block-highlight"
import { motion } from "framer-motion"
import { Terminal, Layers, ShieldCheck, Blocks, ArrowRight, Router } from "lucide-react"

const codeExample = `
// AetherNet: Deploy an AI Agent for IoT Device Management (API v1 - Launching Soon)
import { AetherAgentClient, IoTDeviceConnector } from '@aethernet/sdk';

const aetherClient = new AetherAgentClient({ apiKey: process.env.AETHER_API_KEY });

async function deployDroneFleetManager() {
  const droneAgent = await aetherClient.deployAgent({
    name: 'AutonomousDroneFleetCoordinator',
    description: 'Manages a fleet of delivery drones, optimizing routes and battery usage. Records delivery confirmations to AetherChain.',
    capabilities: ['route_optimization', 'iot_drone_control', 'aetherchain_write_log'],
    
    // Example: Define how agent interacts with a drone (simulated)
    onDroneTelemetry: async (droneId, telemetry, agentContext) => {
      if (telemetry.status === 'LOW_BATTERY') {
        await agentContext.sendCommand(droneId, 'RETURN_TO_BASE');
      }
      // Further logic for route adjustments, etc.
    },
    onDeliveryConfirmation: async (packageId, droneId, location, agentContext) => {
      await agentContext.logToAetherChain('delivery_confirmed', { packageId, droneId, location, timestamp: Date.now() });
      console.log(\`Delivery of \${packageId} by drone \${droneId} confirmed on AetherChain.\`);
    }
  });

  // Connect to a (simulated) drone via IoTDeviceConnector
  const droneConnector = new IoTDeviceConnector({ agentId: droneAgent.id, deviceType: 'drone' });
  droneConnector.on('telemetry', (data) => droneAgent.processEvent('onDroneTelemetry', data.droneId, data.telemetry));
  droneConnector.on('delivery_scan', (data) => droneAgent.processEvent('onDeliveryConfirmation', data.packageId, data.droneId, data.location));

  console.log(\`Drone Fleet Manager Agent \${droneAgent.id} deployed.\`);
}

deployDroneFleetManager();
`

export function DeveloperApiSection() {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  }

  return (
    <section id="developers" className="py-16 md:py-24 bg-gradient-to-b from-gray-900 to-black text-gray-100">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12 md:mb-16"
          initial="hidden"
          whileInView="visible"
          variants={fadeIn}
          viewport={{ once: true, amount: 0.3 }}
        >
          <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-4">
            <Terminal className="h-5 w-5 mr-2" />
            Build on Aether: The Future is Composable & Intelligent
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Unleash Innovation with the Aether SDKs</h2>
          <p className="mt-4 text-lg text-gray-300 max-w-3xl mx-auto">
            Access the full power of the Aether Ecosystem. Our robust APIs and SDKs (AetherNet API v1 launching soon,
            AetherChain API Q3 2025) enable you to create custom AI agents for IoT and robotics, deploy high-performance
            Rust smart contracts, and build transformative, industry-agnostic applications.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            className="space-y-8"
            initial="hidden"
            whileInView="visible"
            variants={{ visible: { transition: { staggerChildren: 0.2, delayChildren: 0.1 } } }}
            viewport={{ once: true }}
          >
            {[
              {
                icon: <Router className="w-7 h-7 text-primary" />,
                title: "AetherNet Agent SDK (API v1 Soon)",
                description:
                  "Develop, deploy, and manage secure AI agents with standardized communication for IoT, robotics, autonomous vehicles, and more.",
              },
              {
                icon: <Blocks className="w-7 h-7 text-primary" />,
                title: "AetherChain Smart Contracts (Q3 2025)",
                description:
                  "Build and deploy high-performance Rust-based smart contracts for verifiable business logic and decentralized workflows.",
              },
              {
                icon: <ShieldCheck className="w-7 h-7 text-primary" />,
                title: "Enterprise-Grade Security & Scalability",
                description:
                  "Leverage our robust infrastructure designed for mission-critical security, performance, and massive scale.",
              },
              {
                icon: <Layers className="w-7 h-7 text-primary" />,
                title: "Modular & Cross-Industry Solutions",
                description:
                  "Utilize Kronova's Business Optimization Engine, Smart Packaging, and Rewards App modules, or build your own solutions on the Aether foundation.",
              },
            ].map((item) => (
              <motion.div key={item.title} variants={fadeIn} className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1 p-2.5 bg-primary/10 rounded-lg">{item.icon}</div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="text-gray-400 mt-1">{item.description}</p>
                </div>
              </motion.div>
            ))}
            <motion.div variants={fadeIn} className="pt-4">
              <Link
                href="/docs"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-8"
              >
                Access Developer Portal <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0, transition: { duration: 0.8, delay: 0.2 } }}
            viewport={{ once: true }}
          >
            <div className="absolute -inset-2 rounded-xl bg-gradient-to-tr from-primary/20 to-emerald-600/20 blur-xl opacity-60"></div>
            <div className="relative z-10">
              <CodeBlockHighlight code={codeExample} language="typescript" />
              <div className="absolute -bottom-6 -right-6 w-56 h-40 opacity-40">
                <Image
                  src="/images/landing/developer-ecosystem-unified.png"
                  alt="Aether API for IoT Agent Example"
                  layout="fill"
                  objectFit="contain"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
