# DataForge

__Your self-hosted Database-as-a-Service (DBaaS)__. > Provision, manage, and backup databases on Kubernetes with a single click.

DataForge is a lightweight, modern platform designed for Homelabs and Internal Developer Platforms. It acts as a "Vending Machine" for databases, allowing developers to spin up production-ready PostgreSQL and Redis instances without writing a single line of YAML.

It bridges the gap between complex operators (like KubeDB) and manual Helm chart deployments.

## Features

- One-Click Provisioning: Spin up PostgreSQL (v15-17) and Redis instances in seconds.
- Production Ready: Automatically configures StatefulSets, Services (LoadBalancer), and Secrets.
- Automated Backups: Built-in scheduler creates nightly dumps and streams them directly to S3/MinIO (no local disk usage).
- Ad-hoc Dumps: Download SQL dumps instantly via the browser for local development.
- Observability: Real-time health checks via Readiness Probes and live status updates.
- Secure by Default: Generates strong credentials and isolates instances via namespaced secrets.
- Modern Stack: Single-container architecture built with Next.js 14+ and TypeScript.

## Roadmap

We are actively working on expanding the platform. Planned features include:

- [ ] __MySQL / MariaDB Support:__ Full support for the LAMP stack favorite.
- [ ] __MongoDB Support:__ NoSQL document store provisioning.
- [ ] __Restore UI:__ Restore backups directly from the dashboard (Point-in-Time Recovery).
- [ ] __Database Cloning:__ One-click cloning of production databases to development environments.
- [ ] __Scale-to-Zero (Sleep Mode):__ Automatically pause unused databases to save cluster resources.
- [ ] __Embedded Admin Tools:__ Integrated Web-UI for SQL (Adminer) and Redis (Redis Commander).
- [ ] __User Management:__ Multi-user support with quotas.
- [ ] __Metrics:__ Prometheus integration for database monitoring.

## Architecture

DataForge follows the Controller Pattern, but simplifies it by integrating the control logic directly into a Next.js application.

- __Frontend:__ React (App Router) + Tailwind CSS for the Dashboard.
- __Backend:__ Next.js API Routes acting as the Kubernetes Controller.
- __Cluster Communication:__ Uses the official `@kubernetes/client-node` library.
- __Storage:__ Relies on default StorageClasses (e.g., Longhorn, Rook-Ceph, or Local Path).
- __Networking:__ Leverages `LoadBalancer` services (requires MetalLB or similar) to assign dedicated IPs to databases.

## Getting Started

### Prerequisites

1. A Kubernetes Cluster (k3s, k0s, minikube, or generic).
2. MetalLB (or a cloud load balancer) configured to assign IPs.
3. A default StorageClass for PVCs.
4. An S3-compatible object storage (e.g., MinIO or AWS S3) for backups.

### Local Development

#### 1. Clone the repository

```shell
git clone https://github.com/marcelhaerle/dataforge.git
cd dataforge
```

#### 2. Install dependencies

```shell
npm install
```

#### 3. Configure Environment

Create a `.env` file in the root directory. You can use `.env.example` as a template.

```
# App Config
NAMESPACE=dataforge-db

# Kubernetes (Optional, defaults to ~/.kube/config)
# KUBECONFIG=.kube-config

# S3 / MinIO Configuration (Required for backups)
S3_ENDPOINT=http://192.168.x.x:9000
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_BUCKET=dataforge-backups
S3_REGION=us-east-1
```

#### 4. Run the Development Server

```shell
npm run dev
```

Open http://localhost:3000 in your browser.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are __greatly appreciated__.

1. Fork the Project (Create your own copy)
2. Create your Feature Branch (`git checkout -b feat/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feat/AmazingFeature`)
5. Open a Pull Request

Please refer to our [Code of Conduct](CODE_OF_CONDUCT.md) to keep this community approachable and welcoming.

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Support

Give a ⭐️ if you like this project!
