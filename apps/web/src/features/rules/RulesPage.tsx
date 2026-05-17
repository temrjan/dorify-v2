import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Text } from '@telegram-apps/telegram-ui';
import { IconChevronRight } from '@shared/ui/icons';

/**
 * Static rules page — referenced from ProductFormPage warning banner.
 * Mirror of `docs/PRODUCT_RULES.md` (kept in sync manually for MVP;
 * markdown-loader integration is a follow-up).
 */
export default function RulesPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.BackButton.show();
    const handler = () => navigate(-1);
    tg?.BackButton.onClick(handler);
    return () => {
      tg?.BackButton.offClick(handler);
      tg?.BackButton.hide();
    };
  }, [navigate]);

  return (
    <div className="pb-8">
      {/* Header с in-page back (TG BackButton не активирует на части платформ) */}
      <div className="sticky top-0 z-10 bg-tg-bg px-4 py-3 flex items-center gap-2 border-b border-tg-secondary/40">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="w-9 h-9 rounded-full bg-tg-section flex items-center justify-center active:scale-95"
        >
          <IconChevronRight width={18} height={18} className="rotate-180" />
        </button>
        <Text className="text-lg font-bold">Правила публикации товаров</Text>
      </div>

      <div className="px-4 pt-4 space-y-5">
        <section>
          <Text className="text-xs uppercase tracking-wider text-tg-hint block mb-2">
            Кратко
          </Text>
          <div className="bg-tg-section rounded-card shadow-card p-4">
            <Text className="text-sm leading-relaxed">
              Аптека сама управляет своим каталогом. Новые товары публикуются сразу — но
              администратор может скрыть товар, если он нарушает эти правила. Аптека
              получит уведомление с причиной и сможет исправить.
            </Text>
          </div>
        </section>

        <section>
          <Text className="text-xs uppercase tracking-wider text-tg-hint block mb-2">
            Запрещённые товары
          </Text>
          <div className="bg-tg-section rounded-card shadow-card p-4 space-y-2 text-sm">
            <p>• Наркотические средства и психотропные вещества из Списка I-IV без специальной лицензии.</p>
            <p>• Контрафактные или поддельные препараты.</p>
            <p>• Препараты с истёкшим сроком годности.</p>
            <p>• БАДы, маркированные как лекарства, с заявленной лечебной эффективностью без подтверждения.</p>
            <p>• Любые товары, продажа которых запрещена законодательством Республики Узбекистан.</p>
          </div>
        </section>

        <section>
          <Text className="text-xs uppercase tracking-wider text-tg-hint block mb-2">
            Требования к карточке товара
          </Text>
          <div className="bg-tg-section rounded-card shadow-card p-4 space-y-2 text-sm">
            <p>• Название — достоверное, без рекламных лозунгов и капслока.</p>
            <p>• Производитель и действующее вещество — корректные.</p>
            <p>• Остаток на складе соответствует фактическому количеству.</p>
            <p>• Цена в сумах, без скрытых наценок.</p>
            <p>• Описание не содержит ложных обещаний о свойствах препарата.</p>
          </div>
        </section>

        <section>
          <Text className="text-xs uppercase tracking-wider text-tg-hint block mb-2">
            Фотографии
          </Text>
          <div className="bg-tg-section rounded-card shadow-card p-4 space-y-2 text-sm">
            <p>• Без чужих водяных знаков и логотипов сторонних магазинов.</p>
            <p>• Желательно реальная фотография упаковки, а не stock-картинка.</p>
            <p>• Без агрессивной графики (стрелки, рамки, акционные плашки).</p>
          </div>
        </section>

        <section>
          <Text className="text-xs uppercase tracking-wider text-tg-hint block mb-2">
            Рецептурные препараты
          </Text>
          <div className="bg-tg-section rounded-card shadow-card p-4 space-y-2 text-sm">
            <p>• Помечайте флагом «По рецепту» при добавлении товара.</p>
            <p>• Продажа покупателю — только при наличии рецепта. Ответственность за проверку рецепта несёт аптека.</p>
          </div>
        </section>

        <section>
          <Text className="text-xs uppercase tracking-wider text-tg-hint block mb-2">
            Что делает модератор при нарушении
          </Text>
          <div className="bg-tg-section rounded-card shadow-card p-4 space-y-2 text-sm">
            <p>• Скрывает товар (не удаляет — данные сохраняются для аудита).</p>
            <p>• Отправляет аптеке уведомление с причиной скрытия.</p>
            <p>• Аптека исправляет и создаёт товар заново.</p>
            <p>• При повторных нарушениях аптека может быть деактивирована.</p>
          </div>
        </section>

        <section>
          <Text className="text-xs uppercase tracking-wider text-tg-hint block mb-2">
            Вопросы и связь
          </Text>
          <div className="bg-tg-section rounded-card shadow-card p-4 text-sm">
            <p>
              По вопросам правил и спорным ситуациям свяжитесь с поддержкой через Telegram-бот{' '}
              <a href="https://t.me/dorify" className="text-dorify-primary font-medium">@dorify</a>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
