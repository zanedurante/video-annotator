"use client";

import React from "react";
import Link from "next/link";
import KappaAgreement from "../../components/ui/KappaAgreement";

export default function KappaPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Nav Bar */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Video Annotation Tool</h1>
          <div className="flex space-x-4">
            <Link
              href="/"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Annotation Tool
            </Link>
            <Link
              href="/kappa"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Kappa Analysis
            </Link>
          </div>
        </div>
        
        {/* Main Content */}
        <KappaAgreement />
      </div>
    </div>
  );
}