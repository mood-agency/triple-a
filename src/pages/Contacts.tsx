import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useContacts } from '@/hooks/useContacts';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Header } from '@/components/Header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Plus, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import type { Contact, ContactInput } from '@/types/contact';

const BEEPER_API_URL = 'http://localhost:23373';
const BEEPER_TIMEOUT_MS = 10000; // 10 seconds timeout

// Validates international phone format: +[country code][number]
function isValidInternationalPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // Must start with + followed by country code (1-3 digits) and phone number (7-14 digits)
  return /^\+\d{1,3}\d{7,14}$/.test(cleaned);
}

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function Contacts() {
  const { t } = useTranslation();
  const { isReady } = useDatabase();
  const { contacts, loading, createContact, updateContact, deleteContact } = useContacts();
  const { settings } = useSettings();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);

  const [formData, setFormData] = useState<ContactInput>({
    name: '',
    lastname: '',
    phone: '',
    email: '',
  });

  // WhatsApp messaging state
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  const [whatsAppContact, setWhatsAppContact] = useState<Contact | null>(null);
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  const handleOpenDialog = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        name: contact.name,
        lastname: contact.lastname,
        phone: contact.phone,
        email: contact.email,
      });
    } else {
      setEditingContact(null);
      setFormData({
        name: '',
        lastname: '',
        phone: '',
        email: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingContact(null);
    setFormData({
      name: '',
      lastname: '',
      phone: '',
      email: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone format
    if (formData.phone && !isValidInternationalPhone(formData.phone)) {
      toast.error(t('contacts.invalidPhone'));
      return;
    }

    try {
      if (editingContact) {
        await updateContact(editingContact.id, formData);
        toast.success(t('contacts.contactUpdated'));
      } else {
        await createContact(formData);
        toast.success(t('contacts.contactCreated'));
      }
      handleCloseDialog();
    } catch (error) {
      toast.error(t('contacts.error'));
      console.error('Error saving contact:', error);
    }
  };

  const handleDeleteClick = (contact: Contact) => {
    setDeletingContact(contact);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingContact) return;

    try {
      await deleteContact(deletingContact.id);
      toast.success(t('contacts.contactDeleted'));
      setIsDeleteDialogOpen(false);
      setDeletingContact(null);
    } catch (error) {
      toast.error(t('contacts.error'));
      console.error('Error deleting contact:', error);
    }
  };

  const handleWhatsAppClick = (contact: Contact) => {
    if (!contact.phone) {
      toast.error(t('contacts.whatsapp.noPhone'));
      return;
    }
    setWhatsAppContact(contact);
    setWhatsAppMessage('');
    setIsWhatsAppDialogOpen(true);
  };

  const handleWhatsAppClose = () => {
    setIsWhatsAppDialogOpen(false);
    setWhatsAppContact(null);
    setWhatsAppMessage('');
  };

  const sendWhatsAppMessage = async () => {
    if (!whatsAppContact || !whatsAppMessage.trim()) return;

    if (!settings.beeperToken) {
      toast.error(t('contacts.whatsapp.noToken'));
      return;
    }

    setIsSendingWhatsApp(true);

    try {
      // Format phone number (remove spaces, dashes, etc.)
      const phoneNumber = whatsAppContact.phone.replace(/[\s\-\(\)]/g, '');

      // First, get WhatsApp account
      const accountsResponse = await fetchWithTimeout(
        `${BEEPER_API_URL}/v1/accounts`,
        {
          headers: {
            'Authorization': `Bearer ${settings.beeperToken}`,
          },
        },
        BEEPER_TIMEOUT_MS
      );

      if (!accountsResponse.ok) {
        throw new Error(t('contacts.whatsapp.beeperNotRunning'));
      }

      const accounts = await accountsResponse.json();
      const whatsappAccount = accounts.find((acc: { accountID?: string; service?: string; network?: string }) =>
        acc.accountID === 'whatsapp' || acc.service === 'whatsapp' || acc.network?.toLowerCase() === 'whatsapp'
      );

      if (!whatsappAccount) {
        throw new Error('No WhatsApp account found in Beeper');
      }

      // Create or get chat with the contact
      const createChatResponse = await fetchWithTimeout(
        `${BEEPER_API_URL}/v1/chats`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.beeperToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountID: whatsappAccount.accountID,
            type: 'single',
            participantIDs: [phoneNumber],
          }),
        },
        BEEPER_TIMEOUT_MS
      );

      if (!createChatResponse.ok) {
        const errorData = await createChatResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create chat');
      }

      const chat = await createChatResponse.json();

      // Get chat ID - try different possible field names
      const chatId = chat.id || chat.chatID || chat.guid;
      if (!chatId) {
        throw new Error('Could not get chat ID from response');
      }

      // Send the message
      const sendResponse = await fetchWithTimeout(
        `${BEEPER_API_URL}/v1/chats/${chatId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.beeperToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: `${whatsAppMessage}\n\n${t('contacts.whatsapp.signature')}`,
          }),
        },
        BEEPER_TIMEOUT_MS
      );

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to send message');
      }

      toast.success(t('contacts.whatsapp.success'));
      handleWhatsAppClose();
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);

      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          toast.error(t('contacts.whatsapp.timeout'));
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          toast.error(t('contacts.whatsapp.connectionFailed'));
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error(t('contacts.whatsapp.error'));
      }
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  if (!isReady || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col py-8 px-4">
      <div className="w-full px-4 flex flex-col flex-1 min-h-0">
        <Header>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                {t('contacts.addContact')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('contacts.addContact')}</p>
            </TooltipContent>
          </Tooltip>
        </Header>

        <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('contacts.name')}</TableHead>
              <TableHead>{t('contacts.lastname')}</TableHead>
              <TableHead>{t('contacts.phone')}</TableHead>
              <TableHead>{t('contacts.email')}</TableHead>
              <TableHead className="text-right">{t('contacts.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t('contacts.noContacts')}
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{contact.lastname}</TableCell>
                  <TableCell>{contact.phone}</TableCell>
                  <TableCell>{contact.email}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleWhatsAppClick(contact)}
                      title={t('contacts.whatsapp.sendMessage')}
                    >
                      <MessageCircle className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(contact)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(contact)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? t('contacts.editContact') : t('contacts.addContact')}
            </DialogTitle>
            <DialogDescription>
              {editingContact ? t('contacts.editDescription') : t('contacts.addDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('contacts.name')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastname">{t('contacts.lastname')}</Label>
                <Input
                  id="lastname"
                  value={formData.lastname}
                  onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">{t('contacts.phone')}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+521234567890"
                  required
                />
                <p className="text-xs text-muted-foreground">{t('contacts.phoneHelp')}</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">{t('contacts.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                {t('cancel')}
              </Button>
              <Button type="submit">
                {editingContact ? t('save') : t('contacts.addContact')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('contacts.deleteContact')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('contacts.deleteConfirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isWhatsAppDialogOpen} onOpenChange={handleWhatsAppClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              {t('contacts.whatsapp.dialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('contacts.whatsapp.dialogDescription', {
                name: whatsAppContact ? `${whatsAppContact.name} ${whatsAppContact.lastname}` : '',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="whatsapp-message">{t('contacts.whatsapp.sendMessage')}</Label>
              <Textarea
                id="whatsapp-message"
                value={whatsAppMessage}
                onChange={(e) => setWhatsAppMessage(e.target.value)}
                placeholder={t('contacts.whatsapp.messagePlaceholder')}
                rows={4}
                className="resize-none"
              />
            </div>
            {whatsAppContact && (
              <p className="text-sm text-muted-foreground">
                {t('contacts.phone')}: {whatsAppContact.phone}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleWhatsAppClose}>
              {t('cancel')}
            </Button>
            <Button
              onClick={sendWhatsAppMessage}
              disabled={isSendingWhatsApp || !whatsAppMessage.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSendingWhatsApp ? t('contacts.whatsapp.sending') : t('contacts.whatsapp.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
