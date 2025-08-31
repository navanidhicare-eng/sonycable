
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
  { id: 'rh1', date: '2024-07-15', description: 'Recharged with SONY PREMIUM', amount: '450', status: 'Paid' },
  { id: 'rh2', date: '2024-06-15', description: 'Recharged with SONY PREMIUM', amount: '450', status: 'Paid' },
  { id: 'rh3', date: '2024-05-15', description: 'Recharged with SONY BASIC', amount: '250', status: 'Paid' },
];

const mockPaymentHistory = [
  { id: 'ph1', date: '2024-07-15', description: 'Payment via UPI', amount: '450' },
  { id: 'ph2', date: '2024-06-15', description: 'Payment via Cash', amount: '450' },
  { id: 'ph3', date: '2024-05-15', description: 'Payment via Cash', amount: '250' },
];

const mockAllTransactions = [
    ...mockRechargeHistory.map(item => ({...item, type: 'Recharge', packageName: item.description.split('with ')[1]})),
    ...mockPaymentHistory.map(item => ({...item, type: 'Payment', method: item.description.split('via ')[1]}))
].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());


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

        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="recharge">Recharge History</TabsTrigger>
            <TabsTrigger value="payment">Payment History</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockAllTransactions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={item.type === 'Recharge' ? 'default' : 'secondary'}>
                            {item.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>₹{item.amount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
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
                        <TableCell>{item.description.split('with ')[1]}</TableCell>
                        <TableCell>₹{item.amount}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === 'Paid' ? 'default' : 'destructive'}>
                            {item.status}
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
                           <Badge variant="secondary">{item.description.split('via ')[1]}</Badge>
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
