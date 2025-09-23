# SnapEdit - Professional Image Editor

## Overview

SnapEdit is a modern, web-based image editing application that specializes in intelligent text detection and replacement within images. Built as a React single-page application, it provides professional-grade image editing capabilities with AI-powered text analysis and seamless editing workflows. The application focuses on screenshot editing and general image manipulation with advanced text handling features.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development practices
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Framework**: Shadcn/ui components built on Radix UI primitives for accessible, customizable interface elements
- **Styling**: Tailwind CSS with custom design system including HSL color variables and gradient definitions
- **Canvas Library**: Fabric.js for advanced image manipulation and drawing operations on HTML5 canvas
- **State Management**: React hooks with TanStack Query for server state management and caching
- **Routing**: React Router for client-side navigation with 404 error handling

### Backend Architecture
- **Server**: Express.js server for API endpoints and static file serving
- **Development Setup**: Concurrent execution of both frontend (Vite) and backend (Express) servers
- **API Structure**: RESTful endpoints with CORS support for cross-origin requests
- **File Handling**: Base64 image data processing with 50MB request limit for large image uploads

### Core Features
- **Intelligent Text Detection**: AI-powered text recognition using multiple LLM providers with fallback strategy
- **Advanced Text Replacement**: Sophisticated text editing with color matching, font analysis, and formatting preservation
- **Canvas-based Editor**: Professional image editing tools including shapes, text overlays, and manipulation controls
- **Image Processing**: Support for various image formats with real-time preview and editing capabilities

### AI Integration Strategy
- **Multi-Provider Approach**: Primary reliance on OpenRouter API with support for multiple AI models
- **Model Prioritization**: Cost-effective to premium model selection using verified OpenRouter models:
  - `google/gemini-2.0-flash-exp` - Fast, optimized for text detection
  - `google/gemini-2.5-flash-preview` - Best for comprehensive text analysis
  - `openai/gpt-4o` - Good all-around performance for various tasks
  - `anthropic/claude-3.5-sonnet` - High accuracy for complex operations
- **Intelligent Fallback**: Automatic model switching on failure to ensure service reliability
- **Advanced Analysis**: Text detection with coordinate mapping, confidence scoring, and contextual understanding

### Design System
- **Color Scheme**: HSL-based color system with light/dark mode support via CSS custom properties
- **Typography**: Responsive font scaling with accessibility considerations
- **Component Library**: Comprehensive UI components covering forms, navigation, overlays, and data display
- **Responsive Design**: Mobile-first approach with adaptive layouts and touch-friendly interactions

## External Dependencies

### AI Services
- **OpenRouter API**: Primary AI service for text detection and analysis across multiple LLM providers
- **Environment Configuration**: API key management through environment variables for secure access

### Third-Party Libraries
- **Fabric.js**: Advanced canvas manipulation library for image editing operations
- **Radix UI**: Headless UI components for accessible interface elements
- **Lucide React**: Icon library providing consistent visual elements
- **React Hook Form**: Form state management with validation capabilities
- **Date-fns**: Date manipulation utilities for timestamping and formatting

### Development Tools
- **ESLint**: Code linting with TypeScript support and React-specific rules
- **TypeScript**: Static type checking with relaxed configuration for rapid development
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer
- **Concurrently**: Parallel execution of development servers

### Deployment Infrastructure
- **Vercel**: Optimized for serverless deployment with function configuration
- **Static Asset Handling**: Efficient serving of built frontend assets
- **API Routes**: Serverless function deployment for backend endpoints