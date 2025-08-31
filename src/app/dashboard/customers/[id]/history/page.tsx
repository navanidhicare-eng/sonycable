
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Mock data - In a real app, you would fetch this based on the customer ID
const mockCustomer = {
  id: 'cust1',
  name: 'Suresh Kumar',
  mobile: '9876543210',
  area: 'KPHB',
  stbId: 'STB12345',
  customerId: 'CUST9876',
};

const mockRechargeHistory = [
  { id: 'rh1', date: '2024-07-15', packageName: 'SONY PREMIUM', amount: '450', paymentStatus: 'Paid' },
  { id: 'rh2', date: '2024-06-15', packageName: 'SONY PREMIUM', amount: '450', paymentStatus: 'Paid' },
  { id: 'rh3', date: '2024-05-15', packageName: 'SONY BASIC', amount: '250', paymentStatus: 'Paid' },
];

const mockPaymentHistory = [
  { id: 'ph1', date: '2024-07-15', amount: '450', method: 'UPI' },
  { id: 'ph2', date: '2024-06-15', amount: '450', method: 'Cash' },
  { id: 'ph3', date: '2024-05-15', amount: '250', method: 'Cash' },
];

export default function CustomerHistoryPage({ params }: { params: { id: string } }) {
  // You can use params.id to fetch the specific customer's data
  const customer = mockCustomer;

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto p-4 py-8 md:p-12">
        <div className="mb-8">
            <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/customers" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Customers</span>
                </Link>
            </Button>
        </div>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">{customer.name}</CardTitle>
            <CardDescription>
              View recharge and payment history for this customer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <p className="font-medium text-muted-foreground">Mobile</p>
                <p>{customer.mobile}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Area</p>
                <p>{customer.area}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">STB ID</p>
                <p>{customer.stbId}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Customer ID</p>
                <p>{customer.customerId}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="recharge">
          <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
            <TabsTrigger value="recharge">Recharge History</TabsTrigger>
            <TabsTrigger value="payment">Payment History</TabsTrigger>
          </TabsList>
          <TabsContent value="recharge">
            <Card>
              <CardHeader>
                <CardTitle>Recharge History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Amount (₹)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockRechargeHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                        <TableCell>{item.packageName}</TableCell>
                        <TableCell>₹{item.amount}</TableCell>
                        <TableCell>
                          <Badge variant={item.paymentStatus === 'Paid' ? 'default' : 'destructive'}>
                            {item.paymentStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="payment">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount (₹)</TableHead>
                      <TableHead>Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockPaymentHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                        <TableCell>₹{item.amount}</TableCell>
                        <TableCell>
                           <Badge variant="secondary">{item.method}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
