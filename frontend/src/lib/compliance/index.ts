import { createClient } from '@supabase/supabase-js';
import { useCallback, useState } from 'react';
import { format } from 'date-fns';

// Compliance standards
export const COMPLIANCE_STANDARDS = {
  // Data retention policies
  dataRetention: {
    auditLogs: 2 * 365, // 2 years
    trainData: 30, // 30 days
    userSessions: 90, // 90 days
    conflicts: 365, // 1 year
    scenarios: 365, // 1 year
  },
  
  // Export formats
  exportFormats: ['json', 'csv', 'pdf', 'xml'] as const,
  
  // Privacy settings
  privacy: {
    anonymizeAfter: 365, // days
    encryptSensitiveData: true,
    allowDataExport: true,
    allowDataDeletion: true,
  },
  
  // Audit requirements
  audit: {
    logAllActions: true,
    includeIpAddress: true,
    includeUserAgent: true,
    includeTimestamp: true,
    retainForYears: 7,
  },
};

export type ExportFormat = typeof COMPLIANCE_STANDARDS.exportFormats[number];

// Data export utilities
export class DataExporter {
  private static supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Export user data
  static async exportUserData(
    userId: string,
    format: ExportFormat = 'json',
    includeAuditLogs: boolean = false
  ): Promise<Blob> {
    try {
      const userData = await this.collectUserData(userId, includeAuditLogs);
      
      switch (format) {
        case 'json':
          return this.exportAsJson(userData);
        case 'csv':
          return this.exportAsCsv(userData);
        case 'pdf':
          return this.exportAsPdf(userData);
        case 'xml':
          return this.exportAsXml(userData);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Data export failed:', error);
      throw error;
    }
  }

  // Collect all user data
  private static async collectUserData(userId: string, includeAuditLogs: boolean) {
    const data: any = {
      exportDate: new Date().toISOString(),
      userId,
      profile: null,
      scenarios: [],
      auditLogs: [],
    };

    // Get user profile
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    data.profile = profile;

    // Get user scenarios
    const { data: scenarios } = await this.supabase
      .from('scenarios')
      .select('*')
      .eq('created_by', userId);
    
    data.scenarios = scenarios || [];

    // Get audit logs if requested
    if (includeAuditLogs) {
      const { data: auditLogs } = await this.supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000); // Limit to last 1000 entries
      
      data.auditLogs = auditLogs || [];
    }

    return data;
  }

  // Export as JSON
  private static exportAsJson(data: any): Blob {
    const jsonString = JSON.stringify(data, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
  }

  // Export as CSV
  private static exportAsCsv(data: any): Blob {
    const csvRows: string[] = [];
    
    // Add header
    csvRows.push('Section,Field,Value');
    
    // Add profile data
    if (data.profile) {
      Object.entries(data.profile).forEach(([key, value]) => {
        csvRows.push(`Profile,${key},"${String(value).replace(/"/g, '""')}"`);
      });
    }
    
    // Add scenarios
    data.scenarios.forEach((scenario: any, index: number) => {
      Object.entries(scenario).forEach(([key, value]) => {
        csvRows.push(`Scenario ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`);
      });
    });
    
    // Add audit logs
    data.auditLogs.forEach((log: any, index: number) => {
      Object.entries(log).forEach(([key, value]) => {
        csvRows.push(`Audit Log ${index + 1},${key},"${String(value).replace(/"/g, '""')}"`);
      });
    });
    
    const csvString = csvRows.join('\n');
    return new Blob([csvString], { type: 'text/csv' });
  }

  // Export as PDF (simplified - would use a proper PDF library in production)
  private static exportAsPdf(data: any): Blob {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>User Data Export</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1, h2 { color: #333; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .section { margin: 30px 0; }
          </style>
        </head>
        <body>
          <h1>User Data Export</h1>
          <p><strong>Export Date:</strong> ${data.exportDate}</p>
          <p><strong>User ID:</strong> ${data.userId}</p>
          
          <div class="section">
            <h2>Profile Information</h2>
            <table>
              <tr><th>Field</th><th>Value</th></tr>
              ${Object.entries(data.profile || {}).map(([key, value]) => 
                `<tr><td>${key}</td><td>${value}</td></tr>`
              ).join('')}
            </table>
          </div>
          
          <div class="section">
            <h2>Scenarios (${data.scenarios.length})</h2>
            ${data.scenarios.map((scenario: any, index: number) => `
              <h3>Scenario ${index + 1}</h3>
              <table>
                <tr><th>Field</th><th>Value</th></tr>
                ${Object.entries(scenario).map(([key, value]) => 
                  `<tr><td>${key}</td><td>${value}</td></tr>`
                ).join('')}
              </table>
            `).join('')}
          </div>
          
          ${data.auditLogs.length > 0 ? `
            <div class="section">
              <h2>Audit Logs (${data.auditLogs.length})</h2>
              <table>
                <tr><th>Date</th><th>Action</th><th>Details</th></tr>
                ${data.auditLogs.map((log: any) => `
                  <tr>
                    <td>${format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}</td>
                    <td>${log.action}</td>
                    <td>${JSON.stringify(log.details)}</td>
                  </tr>
                `).join('')}
              </table>
            </div>
          ` : ''}
        </body>
      </html>
    `;
    
    return new Blob([htmlContent], { type: 'text/html' });
  }

  // Export as XML
  private static exportAsXml(data: any): Blob {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<userDataExport>
  <exportDate>${data.exportDate}</exportDate>
  <userId>${data.userId}</userId>
  
  <profile>
    ${Object.entries(data.profile || {}).map(([key, value]) => 
      `<${key}>${this.escapeXml(String(value))}</${key}>`
    ).join('\n    ')}
  </profile>
  
  <scenarios>
    ${data.scenarios.map((scenario: any, index: number) => `
    <scenario id="${index + 1}">
      ${Object.entries(scenario).map(([key, value]) => 
        `<${key}>${this.escapeXml(String(value))}</${key}>`
      ).join('\n      ')}
    </scenario>`).join('')}
  </scenarios>
  
  <auditLogs>
    ${data.auditLogs.map((log: any, index: number) => `
    <auditLog id="${index + 1}">
      ${Object.entries(log).map(([key, value]) => 
        `<${key}>${this.escapeXml(String(value))}</${key}>`
      ).join('\n      ')}
    </auditLog>`).join('')}
  </auditLogs>
</userDataExport>`;
    
    return new Blob([xmlContent], { type: 'application/xml' });
  }

  // Escape XML special characters
  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// Data anonymization utilities
export class DataAnonymizer {
  private static supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Anonymize user data
  static async anonymizeUserData(userId: string): Promise<void> {
    try {
      // Anonymize profile
      await this.supabase
        .from('profiles')
        .update({
          email: `anonymized_${Date.now()}@example.com`,
          first_name: 'Anonymized',
          last_name: 'User',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      // Anonymize audit logs
      await this.supabase
        .from('audit_logs')
        .update({
          ip_address: '0.0.0.0',
          user_agent: 'Anonymized',
        })
        .eq('user_id', userId);

      console.log(`User data anonymized for user: ${userId}`);
    } catch (error) {
      console.error('Data anonymization failed:', error);
      throw error;
    }
  }

  // Delete user data (GDPR right to be forgotten)
  static async deleteUserData(userId: string): Promise<void> {
    try {
      // Delete in order to respect foreign key constraints
      await this.supabase.from('audit_logs').delete().eq('user_id', userId);
      await this.supabase.from('scenarios').delete().eq('created_by', userId);
      await this.supabase.from('profiles').delete().eq('id', userId);

      console.log(`User data deleted for user: ${userId}`);
    } catch (error) {
      console.error('Data deletion failed:', error);
      throw error;
    }
  }
}

// React hook for compliance operations
export function useCompliance() {
  const [isExporting, setIsExporting] = useState(false);
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const exportUserData = useCallback(async (
    userId: string,
    format: ExportFormat = 'json',
    includeAuditLogs: boolean = false
  ) => {
    setIsExporting(true);
    try {
      const blob = await DataExporter.exportUserData(userId, format, includeAuditLogs);
      
      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-data-${userId}-${format(new Date(), 'yyyy-MM-dd')}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Export failed:', error);
      return false;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const anonymizeUserData = useCallback(async (userId: string) => {
    setIsAnonymizing(true);
    try {
      await DataAnonymizer.anonymizeUserData(userId);
      return true;
    } catch (error) {
      console.error('Anonymization failed:', error);
      return false;
    } finally {
      setIsAnonymizing(false);
    }
  }, []);

  const deleteUserData = useCallback(async (userId: string) => {
    setIsDeleting(true);
    try {
      await DataAnonymizer.deleteUserData(userId);
      return true;
    } catch (error) {
      console.error('Deletion failed:', error);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return {
    exportUserData,
    anonymizeUserData,
    deleteUserData,
    isExporting,
    isAnonymizing,
    isDeleting,
  };
}

// Initialize compliance features
export function initializeCompliance() {
  // Set up automatic data cleanup
  if (typeof window !== 'undefined') {
    // Schedule cleanup every 24 hours
    setInterval(async () => {
      try {
        const response = await fetch('/api/cleanup-data', { method: 'POST' });
        if (response.ok) {
          console.log('✅ Automatic data cleanup completed');
        }
      } catch (error) {
        console.error('❌ Automatic data cleanup failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  console.log('📋 Compliance features initialized');
}
