import { UserButton } from '@/lib/auth-provider';
import { ArrowLeft, User, Bell, Shield, Database } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export default function Settings() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    updates: true,
  });

  const toggleNotification = (type: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            </div>
            <div className="flex items-center space-x-4">
              <UserButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="mb-2 text-3xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-600">Manage your account preferences and application settings.</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                Account Settings
              </CardTitle>
              <CardDescription>
                Manage your personal information and account preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Profile Information</h4>
                  <p className="text-sm text-gray-600">Update your profile details</p>
                </div>
                <Button variant="outline">Edit Profile</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Password & Security</h4>
                  <p className="text-sm text-gray-600">Manage authentication settings</p>
                </div>
                <Button variant="outline">Security Settings</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="mr-2 h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Configure how you want to receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Email Notifications</h4>
                  <p className="text-sm text-gray-600">Receive updates via email</p>
                </div>
                <Button
                  variant={notifications.email ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleNotification('email')}
                >
                  {notifications.email ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Push Notifications</h4>
                  <p className="text-sm text-gray-600">Browser push notifications</p>
                </div>
                <Button
                  variant={notifications.push ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleNotification('push')}
                >
                  {notifications.push ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Product Updates</h4>
                  <p className="text-sm text-gray-600">News about new features</p>
                </div>
                <Button
                  variant={notifications.updates ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleNotification('updates')}
                >
                  {notifications.updates ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Privacy & Security
              </CardTitle>
              <CardDescription>Control your privacy settings and data management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Data Export</h4>
                  <p className="text-sm text-gray-600">Download your data</p>
                </div>
                <Button variant="outline">Export Data</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Privacy Settings</h4>
                  <p className="text-sm text-gray-600">Manage data sharing preferences</p>
                </div>
                <Button variant="outline">Privacy Settings</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="mr-2 h-5 w-5" />
                Application Settings
              </CardTitle>
              <CardDescription>Configure application behavior and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Default Templates</h4>
                  <p className="text-sm text-gray-600">Set preferred document templates</p>
                </div>
                <Button variant="outline">Configure</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Export Preferences</h4>
                  <p className="text-sm text-gray-600">Default export formats and settings</p>
                </div>
                <Button variant="outline">Configure</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">AI Assistance</h4>
                  <p className="text-sm text-gray-600">Configure AI behavior and preferences</p>
                </div>
                <Button variant="outline">Configure</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
