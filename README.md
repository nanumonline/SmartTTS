# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/450a055c-c2b9-4762-81e4-087571701af2

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/450a055c-c2b9-4762-81e4-087571701af2) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/450a055c-c2b9-4762-81e4-087571701af2) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## CORS 문제 해결 (Supertone API)

브라우저에서 Supertone API를 직접 호출하면 CORS 오류가 발생할 수 있습니다. 이를 해결하기 위해 Supabase Edge Function을 프록시로 사용합니다.

### Edge Function 배포

1. Supabase CLI 설치 (아직 설치하지 않은 경우):
```bash
npm install -g supabase
```

2. Supabase 프로젝트에 로그인:
```bash
supabase login
```

3. 프로젝트 링크:
```bash
supabase link --project-ref gxxralruivyhdxyftsrg
```

4. Edge Function 배포:
```bash
supabase functions deploy supertone-proxy
```

### 환경 변수 설정

`.env.local` 파일에 다음 변수를 설정하세요:
```env
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_SUPERTONE_API_KEY=your_supertone_api_key
```

### 사용 방법

- Edge Function이 배포되면 자동으로 프록시를 통해 Supertone API를 호출합니다.
- 프록시 호출이 실패하면 직접 API 호출을 시도하고, 그것도 실패하면 Mock 서비스를 사용합니다.
- 개발 환경에서는 Mock 서비스가 기본적으로 사용되므로 실제 API 연결 없이도 테스트할 수 있습니다.
